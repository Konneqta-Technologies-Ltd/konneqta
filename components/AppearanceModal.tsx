"use client";

import { ALLOWED_IMAGE_TYPES, safeFileExtension } from "@/lib/url-validation";
import { useMemo, useRef, useState } from "react";

import { FONT_OPTIONS, THEME_PRESETS, type ThemeCustomization, resolveTheme } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { renderCardFront } from "./card-layouts";
import Spinner from "./ui/Spinner";
import { toast } from "sonner";

type ProfileData = {
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
};

export default function AppearanceModal({
  open,
  onClose,
  profile,
  currentThemeId,
  currentBannerUrl,
  canUseThemes,
  canUseBanners,
  ownerId,
  cardId,
  initialCustom,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  currentThemeId: string;
  currentBannerUrl: string | null;
  canUseThemes: boolean;
  canUseBanners: boolean;
  ownerId: string;
  cardId?: string;
  initialCustom?: ThemeCustomization | null;
}) {
  const [selectedTheme, setSelectedTheme] = useState(currentThemeId);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(
    currentBannerUrl
  );
  // Custom colors / font / avatar shape. Pro-gated (canUseThemes). Stored on
  // the card as theme_custom (jsonb). Previously this lived in a separate,
  // never-wired-in ThemeCustomizer component that wrote to the wrong table.
  const [custom, setCustom] = useState<ThemeCustomization>(initialCustom ?? {});
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Custom colors/fonts are a Pro feature (same gate as themes).
  const customLocked = !canUseThemes;

  // Live-preview theme: the selected preset merged with the in-progress
  // custom overrides, so the theme thumbnails reflect color/font changes.
  // (useMemo MUST come before the `if (!open) return null` early return —
  // hooks can't be called conditionally.)
  const previewTheme = useMemo(
    () => resolveTheme(selectedTheme, custom),
    [selectedTheme, custom]
  );

  // Update a single custom field.
  function updateCustom<K extends keyof ThemeCustomization>(
    key: K,
    value: ThemeCustomization[K]
  ) {
    setCustom((prev) => ({ ...prev, [key]: value }));
  }

  // Validate hex before updating (allow typing in progress like "#FF").
  function handleColorChange(key: keyof ThemeCustomization, value: string) {
    if (value === "" || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
      updateCustom(key, (value || undefined) as ThemeCustomization[typeof key]);
    }
  }

  function resetCustom() {
    setCustom({});
  }

  if (!open) return null;

  // Preset banner gallery (static files in /public/banners/).
  // All 6 banners are shown to every user (free + pro), but only Pro users
  // can actually APPLY one (the Apply button is gated by canUseBanners).
  // Free users see the gallery so they know what's available on Pro.
  const BANNER_GALLERY = [
    "/banners/banner-1.jpg",
    "/banners/banner-2.jpg",
    "/banners/banner-3.jpg",
    "/banners/banner-4.jpg",
    "/banners/banner-5.jpg",
    "/banners/banner-6.jpg",
  ];

   // Whether banners are actionable. If the user isn't Pro, the gallery is
   // shown as a teaser (clicking a banner shows an upgrade prompt) rather
   // than silently ignoring the click.
   const bannersLocked = !canUseBanners;
  
  // Include the uploaded banner in the gallery so it shows in the preview area
  // Only show it if it's selected and the user is Pro (can upload)
  const BANNER_GALLERY_WITH_UPLOAD = selectedBanner && selectedBanner.startsWith('http') && !bannersLocked
    ? [selectedBanner, ...BANNER_GALLERY]
    : BANNER_GALLERY;

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Banner must be a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    uploadBanner(file);
  };

  const uploadBanner = async (file: File) => {
    // Free users can't upload banners — Pro only.
    if (!canUseBanners) {
      toast.error("Upgrade to Pro to upload a banner");
      return;
    }
    setUploadingBanner(true);
    try {
      const supabase = createClient();
      const fileExt = safeFileExtension(file.name);
      // Store per-card so each card can have its own banner. Falls back to
      // the owner folder if (legacy) cardId isn't passed.
      const filePath = cardId
        ? `${ownerId}/${cardId}/banner.${fileExt}`
        : `${ownerId}/banner.${fileExt}`;

      const { error } = await supabase.storage
        .from("banners")
        .upload(filePath, file, {
          upsert: true,
          // Explicit contentType prevents Supabase Storage from inferring the
          // wrong MIME (which can trigger a 400). Matches the file's type
          // (already validated to be jpeg/png/webp above).
          contentType: file.type,
        });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
      // Cache-bust so the new banner shows immediately (same pattern as avatar).
      setSelectedBanner(`${data.publicUrl}?t=${Date.now()}`);
      toast.success("Banner uploaded");
    } catch {
      toast.error("Could not upload banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleApply = async () => {
    // Enforce Pro gating on apply: a free user must not be able to set a
    // banner even by clicking Apply with one pre-selected. Themes are free
    // to apply (the free preset is always allowed).
    if (!canUseBanners && selectedBanner) {
      toast.error("Upgrade to Pro to set a banner");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // PERSISTENCE FIX: appearance (theme + banner) lives on the CARDS table
      // now (the public profile page reads from cards, not profiles). Save
      // to the specific card when cardId is available; fall back to profiles
      // only for legacy single-card rows that haven't been migrated.
      // If the user isn't Pro, strip any custom overrides so they can't
      // sneak color/font changes through (defense in depth — the UI also
      // disables these controls for free users).
      const effectiveCustom = customLocked ? {} : custom;

      const payload = {
        theme: selectedTheme,
        banner_url: selectedBanner,
        theme_custom: effectiveCustom,
      };

      let error;
      if (cardId) {
        ({ error } = await supabase
          .from("cards")
          .update(payload)
          .eq("id", cardId));
      } else {
        ({ error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", ownerId));
      }

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Appearance updated");
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Customize your card
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ---- THEME SECTION ---- */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Theme
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = selectedTheme === preset.id;
                const isLocked = !preset.isFree && !canUseThemes;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => !isLocked && setSelectedTheme(preset.id)}
                    className={`relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all disabled:cursor-not-allowed ${
                      isSelected
                        ? "border-(--main-orange) ring-2 ring-(--main-orange)/20"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                    }`}
                  >
                    {/* Live preview (scaled down) */}
                    <div
                      className="pointer-events-none flex h-32 items-center justify-center overflow-hidden"
                      style={{ background: preset.colors.bg }}
                    >
                      <div style={{ transform: "scale(0.35)", transformOrigin: "center" }}>
                        <div style={{ width: 260, height: 200 }}>
                          {renderCardFront({
                            profile,
                            theme: preset,
                            bannerUrl: selectedBanner,
                            // onFlip intentionally omitted — this preview
                            // lives inside a <button>, and rendering another
                            // <button> (FlipButton) here causes a nested-
                            // <button> hydration error. Without onFlip,
                            // FlipButton renders a non-interactive <div>.
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Label */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {preset.name}
                      </span>
                      {preset.isFree ? (
                        <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                          Free
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-(--main-orange)">
                          Pro
                        </span>
                      )}
                    </div>

                    {/* Padlock overlay for locked themes */}
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                    )}

                    {/* Selected checkmark */}
                    {isSelected && !isLocked && (
                      <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-(--main-orange) text-white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- CUSTOMIZE SECTION (colors, font, avatar shape) ---- */}
          {/*
            This is the previously-missing "customization" feature. It was
            built in a standalone ThemeCustomizer component but never wired
            into the app. Now integrated here (Pro-gated) so users get full
            control over colors, fonts, and avatar shape in one place.
          */}
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Customize
              </h3>
              {customLocked ? (
                <span className="rounded-full bg-(--main-orange)/10 px-2 py-0.5 text-[10px] font-medium text-(--main-orange)">
                  Pro only
                </span>
              ) : (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  Pro ✓
                </span>
              )}
            </div>
            <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
              {customLocked
                ? "Fine-tune colors, fonts, and avatar shape — upgrade to Pro to unlock."
                : "Override the theme with your own colors, font, and avatar shape."}
            </p>

            {customLocked ? (
              <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-zinc-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-xs">Upgrade to Pro to customize colors & fonts</span>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Colors */}
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Colors</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: "accent", label: "Accent" },
                      { key: "bg", label: "Background" },
                      { key: "text", label: "Name text" },
                      { key: "subtext", label: "Subtitle text" },
                    ] as { key: keyof ThemeCustomization; label: string }[]).map(({ key, label }) => (
                      <div key={key}>
                        <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">{label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={(custom[key] as string) || "#ffffff"}
                            onChange={(e) => updateCustom(key, e.target.value as ThemeCustomization[typeof key])}
                            className="h-9 w-9 cursor-pointer rounded-md border border-zinc-300 bg-none p-0.5 dark:border-zinc-700"
                          />
                          <input
                            type="text"
                            value={(custom[key] as string) || ""}
                            onChange={(e) => handleColorChange(key, e.target.value)}
                            placeholder="#000000"
                            maxLength={7}
                            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Avatar shape */}
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Avatar shape</p>
                  <div className="flex gap-2">
                    {(["circle", "rounded", "square"] as const).map((shape) => {
                      const isActive = (custom.avatarShape ?? "circle") === shape;
                      return (
                        <button
                          key={shape}
                          type="button"
                          onClick={() => updateCustom("avatarShape", shape)}
                          className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 py-3 transition-all ${
                            isActive
                              ? "border-(--main-orange)"
                              : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                          }`}
                        >
                          <div
                            className="h-7 w-7"
                            style={{
                              background: custom.accent || previewTheme.colors.accent,
                              borderRadius:
                                shape === "circle" ? "50%" : shape === "rounded" ? "8px" : "2px",
                            }}
                          />
                          <span className="text-[11px] capitalize text-zinc-500 dark:text-zinc-400">{shape}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font */}
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Font</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(Object.keys(FONT_OPTIONS) as Array<keyof typeof FONT_OPTIONS>)
                      .filter((key) => key !== "henny penny")
                      .map((key) => {
                        const isActive = (custom.fontFamily ?? "inter") === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => updateCustom("fontFamily", key as ThemeCustomization["fontFamily"])}
                            className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-left transition-all ${
                              isActive
                                ? "border-(--main-orange)"
                                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                            }`}
                          >
                            <span
                              className="block text-base text-zinc-900 dark:text-zinc-50"
                              style={{ fontFamily: FONT_OPTIONS[key] }}
                            >
                              Aa
                            </span>
                            <span className="mt-0.5 block text-[10px] capitalize text-zinc-500 dark:text-zinc-400">
                              {key}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Reset customization */}
                <button
                  type="button"
                  onClick={resetCustom}
                  className="text-xs text-zinc-500 transition-colors hover:text-red-500 dark:text-zinc-400"
                >
                  Reset to theme defaults
                </button>
              </div>
            )}
          </div>

          {/* ---- BANNER SECTION ---- */}
          {/*
            BANNERS ARE VISIBLE TO EVERYONE (free + pro). The full gallery
            (all 6) is always shown so free users can see what's available.
            HOWEVER, only Pro users can actually APPLY a banner — selecting
            one as a free user shows an upgrade prompt and does NOT save.
            This satisfies "banners visible to all cards, but only Pro cards
            can have a banner added."
          */}
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Banner
              </h3>
              {bannersLocked ? (
                <span className="rounded-full bg-(--main-orange)/10 px-2 py-0.5 text-[10px] font-medium text-(--main-orange)">
                  Pro only
                </span>
              ) : (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  Pro ✓
                </span>
              )}
            </div>
            <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
              {bannersLocked
                ? "Preview the banners below — upgrade to Pro to apply one to your card."
                : "The virtual background behind your card content."}
            </p>

            {/* Gallery — always visible. For free users each banner gets a
                 Pro lock overlay; clicking it shows an upgrade toast. */}
            <div className="flex flex-wrap gap-2">
              {BANNER_GALLERY_WITH_UPLOAD.map((url) => {
                const isSelected = selectedBanner === url;
                
                // Check if this is the uploaded banner (vs a preset)
                const isUploaded = url.startsWith('http');
                
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      if (bannersLocked) {
                        toast.error("Upgrade to Pro to apply a banner");
                        return;
                      }
                      setSelectedBanner(url);
                    }}
                    className={`relative h-16 w-24 cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-(--main-orange) ring-2 ring-(--main-orange)/20"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Banner option"
                      className="h-full w-full object-cover"
                    />
                    
                    {/* Badge for uploaded banner */}
                    {isUploaded && (
                      <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-(--main-orange) text-white shadow-sm">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Pro lock overlay for free users */}
                    {bannersLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--main-orange) text-white">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Upload button — Pro only */}
              <button
                type="button"
                disabled={uploadingBanner}
                onClick={() => {
                  if (bannersLocked) {
                    toast.error("Upgrade to Pro to upload a banner");
                    return;
                  }
                  bannerInputRef.current?.click();
                }}
                className="relative flex h-16 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-500"
              >
                {uploadingBanner ? (
                  <Spinner size="sm" className="text-zinc-400" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
                <span className="text-[9px]">{uploadingBanner ? "Uploading…" : "Upload"}</span>
                {bannersLocked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                )}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerUpload}
                className="hidden"
              />
            </div>

            {/* Remove banner — only meaningful for Pro users who have one set */}
            {selectedBanner && !bannersLocked && (
              <button
                type="button"
                onClick={() => setSelectedBanner(null)}
                className="mt-3 text-xs text-red-500 transition-colors hover:text-red-600"
              >
                Remove banner
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Spinner size="sm" className="text-white" />}
            {saving ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}