"use client";

import { ALLOWED_IMAGE_TYPES, safeFileExtension } from "@/lib/url-validation";
import { useRef, useState } from "react";

import { THEME_PRESETS } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { renderCardFront } from "./card-layouts";
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
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileData;
  currentThemeId: string;
  currentBannerUrl: string | null;
  canUseThemes: boolean;
  canUseBanners: boolean;
  ownerId: string;
}) {
  const [selectedTheme, setSelectedTheme] = useState(currentThemeId);
  const [selectedBanner, setSelectedBanner] = useState<string | null>(
    currentBannerUrl
  );
  const [saving, setSaving] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Preset banner gallery (static files in /public/banners/)
  const BANNER_GALLERY = [
    "/banners/banner-1.jpg",
    "/banners/banner-2.jpg",
    "/banners/banner-3.jpg",
    "/banners/banner-4.jpg",
  ];

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
    try {
      const supabase = createClient();
      const fileExt = safeFileExtension(file.name);
      const filePath = `${ownerId}/banner.${fileExt}`;

      const { error } = await supabase.storage
        .from("banners")
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data } = supabase.storage.from("banners").getPublicUrl(filePath);
      setSelectedBanner(data.publicUrl);
      toast.success("Banner uploaded");
    } catch {
      toast.error("Could not upload banner");
    }
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          theme: selectedTheme,
          banner_url: selectedBanner,
        })
        .eq("id", ownerId);

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

          {/* ---- BANNER SECTION ---- */}
          <div className="mt-6">
            <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Banner
              {!canUseBanners && (
                <span className="ml-2 text-[10px] font-medium text-(--main-orange)">
                  Pro
                </span>
              )}
            </h3>
            <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
              The virtual background behind your card content.
            </p>

            {/* Locked state */}
            {!canUseBanners ? (
              <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-zinc-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-xs">Upgrade to Pro to set a banner</span>
                </div>
              </div>
            ) : (
              <>
                {/* Gallery + Upload */}
                <div className="flex flex-wrap gap-2">
                  {BANNER_GALLERY.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedBanner(url)}
                      className={`h-16 w-24 cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                        selectedBanner === url
                          ? "border-(--main-orange) ring-2 ring-(--main-orange)/20"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Banner option" className="h-full w-full object-cover" />
                    </button>
                  ))}

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="flex h-16 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:hover:border-zinc-500"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-[9px]">Upload</span>
                  </button>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                </div>

                {/* Remove banner */}
                {selectedBanner && (
                  <button
                    type="button"
                    onClick={() => setSelectedBanner(null)}
                    className="mt-3 text-xs text-red-500 transition-colors hover:text-red-600"
                  >
                    Remove banner
                  </button>
                )}
              </>
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
            className="flex-1 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}