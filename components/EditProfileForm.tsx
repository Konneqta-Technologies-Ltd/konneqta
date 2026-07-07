"use client";

import {
  ALLOWED_IMAGE_TYPES,
  isSafeEmailValue,
  isSafeHttpUrl,
  safeFileExtension,
} from "@/lib/url-validation";
import { dataUrlToBlob, generateQrDataUrl } from "@/lib/qr";
import { useRef, useState } from "react";

import CardSwitcher from "./CardSwitcher";
import InfoTip from "./InfoTip";
import ProGate from "./ProGate";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type CardSummary = {
  id: string;
  slug: string;
  label: string;
  is_primary: boolean;
};

interface EditProfileFormProps {
  initialProfile: {
    username: string;
    full_name: string;
    email: string;
    job_title: string;
    company: string;
    phone: string;
    show_phone: boolean;
    bio: string;
    avatar_url: string;
    logo_url: string;
  };
  initialSocialLinks: { id?: string; platform: string; url: string }[];
  canUploadLogo?: boolean;
  maxCards: number;
  cardId: string;
  cardSlug: string;
  isPrimaryCard: boolean;
  allCards: CardSummary[];
}

type SocialLink = {
  id?: string;
  platform: string;
  url: string;
};

export default function EditProfileForm({
  initialProfile,
  initialSocialLinks,
  canUploadLogo = false,
  maxCards = 1,
  cardId,
  cardSlug,
  isPrimaryCard,
  allCards,
}: EditProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(initialProfile);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    initialSocialLinks.length > 0
      ? initialSocialLinks
      : [{ platform: "website", url: "" }]
  );

  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>(
    initialProfile.avatar_url ?? ""
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // Username is now LOCKED (card #1 slug = username, can't change)
    if (e.target.name === "username") return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Avatar must be a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Logo must be a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be less than 5MB");
      return;
    }
    setLogoFile(file);
  };

  const addSocialLink = () => {
    setSocialLinks((prev) => [...prev, { platform: "website", url: "" }]);
  };
  const removeSocialLink = (index: number) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  };
  const updateSocialLink = (index: number, field: keyof SocialLink, value: string) => {
    setSocialLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to update your profile");
        return;
      }

      // 1. Upload avatar
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        const fileExt = safeFileExtension(avatarFile.name);
        const filePath = `${user.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars").upload(filePath, avatarFile, { upsert: true });
        if (uploadError) { toast.error(uploadError.message); return; }
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = publicUrl;
      }

      // 1b. Upload logo
      let logoUrl = form.logo_url;
      if (logoFile) {
        const fileExt = safeFileExtension(logoFile.name);
        const filePath = `${user.id}/logo.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("logos").upload(filePath, logoFile, { upsert: true });
        if (uploadError) { toast.error(uploadError.message); return; }
        const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(filePath);
        logoUrl = publicUrl;
      }

      // 2. UPDATE THE CARD ROW (card-specific fields)
      const { error: cardError } = await supabase
        .from("cards")
        .update({
          full_name: form.full_name,
          job_title: form.job_title,
          company: form.company,
          bio: form.bio,
          avatar_url: avatarUrl,
          logo_url: logoUrl,
        })
        .eq("id", cardId);

      if (cardError) {
        toast.error(cardError.message);
        return;
      }

      // 3. UPDATE THE PROFILE ROW (account-level: phone, show_phone)
      const phoneIsEmpty = !form.phone.trim();
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: form.phone,
          show_phone: phoneIsEmpty ? false : form.show_phone,
        })
        .eq("id", user.id);

      if (profileError) {
        toast.error(profileError.message);
        return;
      }

      // 4. Sync social links (by card_id now)
      const { error: deleteError } = await supabase
        .from("social_links").delete().eq("card_id", cardId);
      if (deleteError) {
        toast.error("Could not update social links (delete failed).");
        return;
      }

      const linksToInsert = socialLinks
        .filter((link) => {
          const trimmed = link.url.trim();
          if (!trimmed) return false;
          return link.platform === "email"
            ? isSafeEmailValue(trimmed)
            : isSafeHttpUrl(trimmed);
        })
        .map((link) => ({
          card_id: cardId,
          profile_id: user.id, // keep for backward compat
          platform: link.platform,
          url: link.url.trim(),
        }));

      if (linksToInsert.length > 0) {
        const { error: linksError } = await supabase
          .from("social_links").insert(linksToInsert);
        if (linksError) {
          toast.error("Profile updated, but we couldn't save your social links.");
          return;
        }
      }

      // 5. Regenerate QR (per-card, based on slug)
      const logoChanged = Boolean(logoFile);
      if (logoChanged) {
        try {
          const profileUrl = `${window.location.origin}/${cardSlug}`;
          const qrDataUrl = await generateQrDataUrl({ profileUrl, logoUrl: logoUrl || null });
          const qrBlob = dataUrlToBlob(qrDataUrl);
          const qrPath = `${user.id}/${cardId}/qr.png`;
          const { error: qrUploadError } = await supabase.storage
            .from("qrcodes").upload(qrPath, qrBlob, { upsert: true, contentType: "image/png" });
          if (!qrUploadError) {
            const { data: { publicUrl: qrPublicUrl } } = supabase.storage.from("qrcodes").getPublicUrl(qrPath);
            await supabase.from("cards").update({ qr_code_url: qrPublicUrl }).eq("id", cardId);
          }
        } catch (qrErr) {
          console.error("qr regeneration error:", qrErr);
        }
      }

      toast.success("Card updated successfully");
      router.refresh();
      router.push(`/${cardSlug}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500";
  const disabledInputClassName =
    "w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Edit Card
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isPrimaryCard ? "Your primary card" : `Editing ${cardSlug}`}
        </p>

        {/* ---- Card Switcher ---- */}
        <div className="mt-4">
          <CardSwitcher cards={allCards} currentCardId={cardId} username={form.username} maxCards={maxCards} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0 m-auto text-zinc-400 dark:text-zinc-500">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} className="hidden" />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {avatarPreview ? "Click to change photo" : "Click to upload photo"}
            </p>
          </div>

          {/* Username — LOCKED (multi-card: username is immutable) */}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Username{" "}
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">(locked — this is your account identity)</span>
            </label>
            <input id="username" type="text" name="username" value={form.username} disabled className={disabledInputClassName} />
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Full Name</label>
            <input id="full_name" type="text" name="full_name" value={form.full_name} onChange={handleChange} className={inputClassName} />
          </div>

          {/* Email (locked) */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">(locked)</span>
            </label>
            <input id="email" type="email" name="email" value={form.email} disabled className={disabledInputClassName} />
          </div>

          {/* Job Title + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="job_title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Job Title</label>
              <input id="job_title" type="text" name="job_title" placeholder="Software Engineer" value={form.job_title} onChange={handleChange} className={inputClassName} />
            </div>
            <div>
              <label htmlFor="company" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Company</label>
              <input id="company" type="text" name="company" placeholder="Acme Inc." value={form.company} onChange={handleChange} className={inputClassName} />
            </div>
          </div>

          {/* Phone + show-in-vCard toggle */}
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone</label>
            <input id="phone" type="tel" name="phone" placeholder="+44 7700 900000" value={form.phone} onChange={handleChange} className={inputClassName} />
            <div className="mt-2 flex items-center gap-2">
              <button type="button" role="switch" aria-checked={form.show_phone} disabled={form.phone.trim().length === 0}
                onClick={() => setForm((prev) => ({ ...prev, show_phone: !prev.show_phone }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${form.show_phone ? "bg-(--main-orange)" : "bg-zinc-300 dark:bg-zinc-700"}`}
                aria-label="Show phone number in contact file">
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.show_phone ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{form.phone.trim() ? "Show in contact file" : "Enter a number to enable"}</span>
              <InfoTip content="When ON, your phone number is included in the .vcf contact file people download." side="top" />
            </div>
          </div>

          {/* Logo (Pro) */}
          <div>
            <label htmlFor="logo" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Logo <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{canUploadLogo ? "(optional)" : "(Pro)"}</span>
            </label>
            <ProGate allowed={canUploadLogo} label="Logo upload">
              <input id="logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoSelect} disabled={!canUploadLogo} className={inputClassName} />
            </ProGate>
            {canUploadLogo && logoFile ? (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">{logoFile.name} selected</p>
            ) : canUploadLogo && form.logo_url ? (
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Current logo set</p>
            ) : null}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Bio</label>
            <textarea id="bio" name="bio" placeholder="What do you want people to know?" value={form.bio} onChange={handleChange} rows={3} className={inputClassName} />
          </div>

          {/* Social Links */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Social Links</label>
              <button type="button" onClick={addSocialLink} className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Add Link
              </button>
            </div>
            <div className="scrollable-links flex min-h-10 max-h-50 flex-col gap-2 overflow-y-auto pr-1">
              {socialLinks.map((link, index) => {
                const platform = SOCIAL_PLATFORMS.find((p) => p.id === link.platform);
                const PlatformIcon = platform?.icon;
                return (
                  <div key={index} className="flex shrink-0 items-start gap-2">
                    <div className="relative shrink-0">
                      {PlatformIcon && <PlatformIcon className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />}
                      <select value={link.platform} onChange={(e) => updateSocialLink(index, "platform", e.target.value)}
                        className={`w-30 rounded-lg border border-zinc-300 bg-white py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${PlatformIcon ? "pl-8 pr-2" : "px-2"}`}>
                        {SOCIAL_PLATFORMS.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                      </select>
                    </div>
                    <input type="url" value={link.url} onChange={(e) => updateSocialLink(index, "url", e.target.value)} placeholder={platform?.placeholder ?? "https://..."} className={inputClassName} />
                    <button type="button" onClick={() => removeSocialLink(index)} className="mt-0.5 shrink-0 cursor-pointer rounded-md p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40" aria-label="Remove link">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setShowCancelDialog(true)} className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Updating..." : "Update Card"}</button>
          </div>
        </form>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCancelDialog(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Discard changes?</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">If you leave now, any unsaved changes will be lost.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowCancelDialog(false)} className="flex-1 cursor-pointer rounded-lg bg-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600">Cancel</button>
              <button type="button" onClick={() => router.push(`/${cardSlug}`)} className="flex-1 cursor-pointer rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white hover:bg-red-600">Discard</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}