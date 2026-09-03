'use client';

import {
  ALLOWED_IMAGE_TYPES,
  isSafeEmailValue,
  isSafeHttpUrl,
  safeFileExtension,
} from '@/lib/url-validation';
import { AVATAR_OPTIONS, LOGO_OPTIONS, compressImage } from '@/lib/image';
import {
  dataUrlToBlob,
  generateQrDataUrl,
  getCanonicalProfileUrl,
} from '@/lib/qr';
import { useEffect, useRef, useState } from 'react';

import { BIO_MAX_CHARS } from '@/components/card-layouts/CardBio';
import InfoTip from './InfoTip';
import Link from 'next/link';
import { PLAN_LIMITS } from '@/lib/entitlements';
import ProGate from './ProGate';
import { SOCIAL_PLATFORMS } from '@/lib/social-platforms';
import Spinner from './ui/Spinner';
import { awardMilestone } from '@/lib/feedback/score';
import {
  MIN_REFERRAL_CODE_LENGTH,
  clearStoredReferralCode,
  normalizeReferralCode,
  readStoredReferralCode,
} from '@/lib/referrals/shared';
import { createClient } from '@/lib/supabase/client';
import { isReservedUsername } from '@/lib/reserved-usernames';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface OnboardingFormProps {
  fullName: string;
  email: string;
}

type SocialLink = {
  platform: string;
  url: string;
  /** Optional custom display name (only used by the "other"/Custom Link platform). */
  label?: string;
};

export default function OnboardingForm({
  fullName,
  email,
}: OnboardingFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    username: '',
    full_name: fullName,
    email: email,
    job_title: '',
    company: '',
    phone: '',
    show_phone: false,
    bio: '',
    avatar_url: '',
    logo_url: '',
  });

  // Social links — dynamic list the user builds during onboarding
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Async check result (only set inside the debounce callback to satisfy
  // React's rule against calling setState synchronously in an effect)
  const [usernameCheck, setUsernameCheck] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Normalize username as the user types: lowercase, alphanumeric + underscores only
    if (e.target.name === 'username') {
      const normalized = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      setForm({ ...form, username: normalized });
      return;
    }
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Derived validation — computed during render, no setState needed.
  // Reserved-word check is instant + local (zero network) so unusable names
  // get feedback on the very keystroke that types them; it mirrors the DB's
  // validate_card_slug list plus the Next.js routes sharing /<name>.
  const username = form.username.trim();
  const usernameTooShort = username.length > 0 && username.length < 3;
  const usernameInvalid =
    username.length >= 3 && !/^(?!.*[_]$)[a-z0-9_]{3,20}$/.test(username);
  const usernameReserved = username.length >= 3 && isReservedUsername(username);
  // Trailing underscore specifically — allowed characters, invalid placement.
  // (A LEADING underscore is intentionally allowed.)
  const usernameEndsWithUnderscore = username.endsWith('_');

  // Final status used by the UI (combines derived + async)
  const usernameStatus:
    | 'idle'
    | 'checking'
    | 'available'
    | 'taken'
    | 'reserved'
    | 'invalid'
    | 'trailing-underscore' = usernameTooShort
    ? 'idle'
    : usernameInvalid
      ? usernameEndsWithUnderscore
        ? 'trailing-underscore'
        : 'invalid'
      : usernameReserved
        ? 'reserved'
        : usernameCheck;

  // Debounced availability check — only runs for valid, non-reserved names.
  // 250ms: fast typists hit ~5-8 keys/sec, so shorter debounces fire mid-word
  // queries (wasted round-trips, rate-limit risk) without feedback feeling
  // any sooner — the network round-trip dominates either way.
  // STALE-RESPONSE GUARD: a reply is applied only if the typed username is
  // still the one it was issued for — out-of-order replies are dropped, so
  // the UI can never show a status for a name the user is no longer typing.
  // HEAD query: fetches no rows, just the exact count over the indexed
  // unique column — tiny payload, same accuracy.
  useEffect(() => {
    if (!username || usernameTooShort || usernameInvalid || usernameReserved) {
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setUsernameCheck('checking');
        const supabase = createClient();
        const { count, error } = await supabase
          .from('profiles')
          .select('username', { count: 'exact', head: true })
          .eq('username', username);

        // Stale-response guard: user typed something else in the meantime.
        if (username !== form.username.trim()) return;

        if (error) {
          console.error('username check error:', error);
          setUsernameCheck('idle');
          return;
        }

        setUsernameCheck((count ?? 0) > 0 ? 'taken' : 'available');
      } catch {
        setUsernameCheck('idle');
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username]);

  // ---- Referral code (optional) --------------------------------------------
  // Pre-filled from the localStorage stash (set when the user arrived via a
  // ?ref= link on /auth/signup) and fully editable — covers the word-of-mouth
  // case where a friend shared their code verbally.
  const [referralCode, setReferralCode] = useState('');
  const [referralCheck, setReferralCheck] = useState<
    'idle' | 'checking' | 'valid' | 'invalid'
  >('idle');

  // Prefill once on mount (setState in the timer callback, not the effect
  // body — react-hooks/set-state-in-effect; the value is browser-only).
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = readStoredReferralCode();
      if (stored) setReferralCode(stored);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Debounced existence check — same shape as the username check above
  // (250ms debounce, HEAD count on the indexed unique column, stale-response
  // guard). Codes are public by design (they live in share links), so this
  // reveals nothing sensitive. The real rules (self-referral, one referrer,
  // before-first-payment) are enforced server-side at attach time.
  useEffect(() => {
    const normalized = normalizeReferralCode(referralCode);

    const debounceTimer = setTimeout(async () => {
      // Empty / too-short codes resolve inside the timer callback so the
      // effect body itself never calls setState (react-hooks rule).
      if (!normalized) {
        setReferralCheck('idle');
        return;
      }
      if (normalized.length < MIN_REFERRAL_CODE_LENGTH) {
        setReferralCheck('invalid');
        return;
      }

      try {
        setReferralCheck('checking');
        const supabase = createClient();
        const { count, error } = await supabase
          .from('profiles')
          .select('referral_code', { count: 'exact', head: true })
          .eq('referral_code', normalized);

        // Stale-response guard: user typed something else in the meantime.
        if (normalized !== normalizeReferralCode(referralCode)) return;

        if (error) {
          console.error('referral code check error:', error);
          setReferralCheck('idle');
          return;
        }

        setReferralCheck((count ?? 0) > 0 ? 'valid' : 'invalid');
      } catch {
        setReferralCheck('idle');
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(debounceTimer);
  }, [referralCode]);

  // Store the selected file locally + show a preview.
  // Upload only happens on submit (see handleSubmit). The image is compressed
  // in the browser first (resize ≤512px, JPEG quality 0.92) so we never store
  // or serve a multi-megabyte photo — visually lossless for a small avatar.
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Avatar must be a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image must be less than 3MB');
      return;
    }

    // Compress + resize before storing the file for upload on submit.
    const compressed = await compressImage(file, AVATAR_OPTIONS);

    // Revoke previous preview to avoid memory leaks
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(compressed);
    setAvatarPreview(URL.createObjectURL(compressed));
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Store the selected logo file locally (no preview, just a name indicator).
  // Upload only happens on submit. Strict image-only check enforced both
  // client-side here and server-side via the Supabase bucket's allowed_mime_types.
  // Compressed in-browser (≤256px PNG) so oversized source art doesn't bloat
  // the upload; transparency is preserved by keeping the PNG output format.
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Logo must be a JPG, PNG, or WebP image');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Logo must be less than 1MB');
      return;
    }

    const compressed = await compressImage(file, LOGO_OPTIONS);
    setLogoFile(compressed);
  };

  // ---- Social link handlers ----
  // Onboarding users are always FREE tier, so the link cap is the free limit
  // (3). Once they upgrade to Pro, they can add up to 7 from the edit page.
  const maxLinks = PLAN_LIMITS.free.maxSocialLinks;

  const addSocialLink = () => {
    if (socialLinks.length >= maxLinks) {
      toast.error(
        `Free accounts are limited to ${maxLinks} social links. Upgrade to Pro for ${PLAN_LIMITS.pro.maxSocialLinks}.`,
      );
      return;
    }
    setSocialLinks((prev) => [...prev, { platform: 'website', url: '' }]);
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSocialLink = (
    index: number,
    field: keyof SocialLink,
    value: string,
  ) => {
    setSocialLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  };

  // Switching platforms in the dropdown. For "email" we pre-fill the account
  // email (users almost always want their own address, and a raw email — NOT
  // a mailto: URL — is what the DB CHECK constraint and safeHref() expect).
  // Switching away from email clears the auto-filled value so it doesn't
  // silently fail http(s) validation on submit.
  const handlePlatformChange = (index: number, newPlatform: string) => {
    setSocialLinks((prev) =>
      prev.map((link, i) => {
        if (i !== index) return link;
        if (newPlatform === 'email') {
          const trimmed = link.url.trim();
          const alreadyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
          return {
            ...link,
            platform: newPlatform,
            url: alreadyEmail ? trimmed : form.email,
          };
        }
        if (link.platform === 'email' && link.url.trim() === form.email) {
          return { ...link, platform: newPlatform, url: '' };
        }
        // Leaving "other" (Custom Link) — drop the custom name; it only
        // applies to custom links and would be dead data on real platforms.
        if (link.platform === 'other') {
          return { ...link, platform: newPlatform, label: '' };
        }
        return { ...link, platform: newPlatform };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!agreedToTerms) {
      toast.error(
        'Please accept the privacy policy and terms of use to continue',
      );
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('You must be logged in to create a profile');
        return;
      }

      // 1. Upload avatar (only happens on submit, not on selection)
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        const fileExt = safeFileExtension(avatarFile.name);
        const filePath = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          toast.error(uploadError.message);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrl;
      }

      // 1b. Upload logo (optional, only if a file was selected)
      let logoUrl = form.logo_url;
      if (logoFile) {
        const fileExt = safeFileExtension(logoFile.name);
        const filePath = `${user.id}/logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          toast.error(uploadError.message);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('logos').getPublicUrl(filePath);
        logoUrl = publicUrl;
      }

      // 2. Create or repair the profile row. Upsert is intentional: a prior
      // interrupted attempt may have left the profile without its card.
      //    show_phone is forced to false when the phone field is empty, so
      //    the owner can never accidentally expose a number they left blank.
      const phoneIsEmpty = !form.phone.trim();
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          ...form,
          show_phone: phoneIsEmpty ? false : form.show_phone,
          avatar_url: avatarUrl,
          logo_url: logoUrl,
          id: user.id,
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        // Provide user-friendly error messages based on the database error
        let errorMessage = profileError.message;

        if (
          errorMessage.toLowerCase().includes('duplicate') ||
          errorMessage.toLowerCase().includes('unique constraint')
        ) {
          errorMessage =
            'This username is already taken. Please choose another.';
        } else if (
          errorMessage.toLowerCase().includes('violates constraint') ||
          errorMessage.toLowerCase().includes('character')
        ) {
          errorMessage =
            'Username contains invalid characters. Please use only lowercase letters, numbers, and underscores.';
        } else if (errorMessage.includes('profile_pkey')) {
          errorMessage =
            "We couldn't create your profile. Double-check your username (3–20 letters, numbers, underscores) and try again.";
        }

        toast.error(errorMessage);
        return;
      }

      // 3. Create the user's PRIMARY card.
      //    The public profile page (app/[username]/page.tsx) reads from the
      //    `cards` table by slug — NOT from `profiles`. So without this row,
      //    /<username> finds nothing and bounces the user back to home,
      //    leaving them stuck in a redirect loop. This is the multi-card
      //    model: profiles = account identity, cards = public-facing data.
      const { data: cardRow, error: cardError } = await supabase
        .from('cards')
        .insert({
          owner_id: user.id,
          slug: form.username,
          label: 'Primary',
          full_name: form.full_name,
          job_title: form.job_title,
          company: form.company,
          bio: form.bio,
          avatar_url: avatarUrl,
          logo_url: logoUrl,
          phone: form.phone,
          show_phone: phoneIsEmpty ? false : form.show_phone,
          is_primary: true,
          sort_order: 0,
        })
        .select('id')
        .single();

      if (cardError) {
        // ROLLBACK: the profile row was already committed in step 2. Without
        // this, the user is stuck: /<username> 404s (the public page reads
        // from `cards`) and retrying hits a duplicate-key error on username.
        // The route deletes the caller's profile ONLY when they have zero
        // cards, so a retry starts from a clean slate.
        await fetch('/api/onboarding/rollback', { method: 'POST' });
        toast.error(cardError.message);
        return;
      }

      const cardId = cardRow.id;

      // Award CREATED_CARD feedback milestone (one-time, fire-and-forget).
      void awardMilestone(user.id, 'CREATED_CARD');
      // Award UPLOADED_AVATAR milestone if the user uploaded a photo.
      if (avatarFile) {
        void awardMilestone(user.id, 'UPLOADED_AVATAR');
      }

      // 3b. Point active_card_id at the new card so /post-login can
      //     redirect straight to it on future logins.
      const { error: activeCardError } = await supabase
        .from('profiles')
        .update({ active_card_id: cardId })
        .eq('id', user.id);

      if (activeCardError) {
        // Non-fatal — profile + card exist, just no active pointer.
        // /post-login falls back to finding the primary card.
        console.error('active_card_id update error:', activeCardError);
      }

      // 4. Insert any social links the user added.
      //    SECURITY: reject dangerous URL schemes (javascript:, data:, etc.)
      //    before they reach the DB. The DB CHECK constraint is the real
      //    barrier; this is defense-in-depth + user feedback.
      const linksToInsert = socialLinks
        .filter((link) => {
          const trimmed = link.url.trim();
          if (!trimmed) return false;
          return link.platform === 'email'
            ? isSafeEmailValue(trimmed)
            : isSafeHttpUrl(trimmed);
        })
        .map((link) => ({
          card_id: cardId,
          profile_id: user.id, // keep for backward compat
          platform: link.platform,
          url: link.url.trim(),
          // Custom display name — only stored for "Custom Link" entries.
          label:
            link.platform === 'other' && link.label?.trim()
              ? link.label.trim()
              : null,
        }));

      if (linksToInsert.length > 0) {
        const { error: linksError } = await supabase
          .from('social_links')
          .insert(linksToInsert);

        if (linksError) {
          // Profile was created but links failed — warn but still proceed
          console.error('social_links insert error:', linksError);
          toast.error(
            "Profile created, but we couldn't save your social links. You can add them later.",
          );
        }
      }

      // 4b. Attach the referral code (if any) — fire-and-forget, exactly like
      //     the milestone awards above. A referral must NEVER block or fail
      //     profile creation: worst case the code doesn't attach (invalid,
      //     self-referral, already used) and the user simply isn't tracked.
      //     All rules are re-enforced server-side in /api/referrals/attach.
      const codeToAttach = normalizeReferralCode(referralCode);
      if (codeToAttach.length >= MIN_REFERRAL_CODE_LENGTH) {
        void fetch('/api/referrals/attach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeToAttach }),
        })
          .then(async (res) => {
            if (res.ok) {
              clearStoredReferralCode();
            } else {
              const data = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              console.warn('[onboarding] referral attach failed:', data?.error);
            }
          })
          .catch(() => {
            // Network hiccup — nothing to do, the code stays stashed and the
            // user can still apply it later from the /referral page.
          });
      }

      // 5. Generate + persist the profile QR code (client-side gen → Storage).
      //    Failure here must NOT block the profile — warn and proceed.
      //    One retry is attempted on a Storage error to ride out transient RLS
      //    propagation / network hiccups; the profile is already created, so
      //    this is best-effort. (Run supabase/fix-qrcodes-upload-policy.sql to
      //    resolve the persistent "new row violates row-level security policy".)
      //
      //    QR codes are stored per-card under <userId>/<cardId>/qr.png so each
      //    card can have its own (matching its slug/logo). The qr_code_url lives
      //    on the `cards` row, not `profiles` — the public page reads it there.
      try {
        // Use the canonical production origin (NEXT_PUBLIC_SITE_URL) so
        // the QR never bakes in localhost. Falls back gracefully if unset.
        const profileUrl = getCanonicalProfileUrl(form.username);
        const qrDataUrl = await generateQrDataUrl({
          profileUrl,
          logoUrl: logoUrl || null,
        });
        const qrBlob = dataUrlToBlob(qrDataUrl);
        const qrPath = `${user.id}/${cardId}/qr.png`;

        let qrUploadError: unknown = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const { error } = await supabase.storage
            .from('qrcodes')
            .upload(qrPath, qrBlob, {
              upsert: true,
              contentType: 'image/png',
            });
          qrUploadError = error;
          if (!error) break;
          if (attempt === 1) {
            // Brief pause before the single retry.
            await new Promise((r) => setTimeout(r, 800));
          }
        }

        if (qrUploadError) {
          console.error('qr upload error:', qrUploadError);
          toast.warning(
            'Profile created, but your QR code couldn’t be saved. You can regenerate it later from your profile.',
          );
        } else {
          const {
            data: { publicUrl: qrPublicUrl },
          } = supabase.storage.from('qrcodes').getPublicUrl(qrPath);

          await supabase
            .from('cards')
            .update({ qr_code_url: qrPublicUrl })
            .eq('id', cardId);
        }
      } catch (qrErr) {
        console.error('qr generation error:', qrErr);
        toast.warning(
          'Profile created, but your QR code couldn’t be generated. You can regenerate it later from your profile.',
        );
      }

      router.push(`/${form.username}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500';

  const disabledInputClassName =
    'w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black"
      data-tour="owner-card"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Create your ID Card
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fill in your details to set up your profile.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {/* Avatar upload */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={32}
                  height={32}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute inset-0 m-auto text-zinc-400 dark:text-zinc-500"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />

            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {avatarPreview
                ? 'Click to change photo'
                : 'Click to upload photo'}
            </p>
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              name="username"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
              required
              className={
                usernameStatus === 'taken' ||
                usernameStatus === 'invalid' ||
                usernameStatus === 'reserved' ||
                usernameStatus === 'trailing-underscore'
                  ? inputClassName +
                    ' border-red-500 focus:border-(--main-orange) focus:ring-red-500'
                  : usernameStatus === 'available'
                    ? inputClassName +
                      ' border-green-500 focus:border-green-500 focus:ring-green-500'
                    : inputClassName
              }
            />
            {/* Username availability feedback */}
            {(usernameStatus === 'invalid' ||
              usernameStatus === 'trailing-underscore') && (
              <p className="mt-1 text-xs text-red-500">
                {usernameStatus === 'trailing-underscore'
                  ? "Usernames can't end with an underscore — remove the last _"
                  : username.length > 20
                    ? 'Too long — usernames are 3–20 characters.'
                    : 'Use 3–20 lowercase letters, numbers or underscores — no spaces or symbols.'}
              </p>
            )}
            {usernameStatus === 'reserved' && (
              <p className="mt-1 text-xs text-red-500">
                @{username} is reserved and can&rsquo;t be used — try another
              </p>
            )}
            {usernameStatus === 'checking' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                <svg
                  className="h-3 w-3 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Checking availability...
              </p>
            )}
            {usernameStatus === 'available' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                @{username} is available!
              </p>
            )}
            {usernameStatus === 'taken' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                @{username} is already taken
              </p>
            )}
          </div>

          {/* Full Name — pre-filled from Google, editable */}
          <div>
            <label
              htmlFor="full_name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Full Name
            </label>
            <input
              id="full_name"
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              className={inputClassName}
            />
          </div>

          {/* Email — pre-filled from Google, immutable */}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email{' '}
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                (locked)
              </span>
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              disabled
              className={disabledInputClassName}
            />
          </div>

          {/* Job Title + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="job_title"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Job Title
              </label>
              <input
                id="job_title"
                type="text"
                name="job_title"
                placeholder="Software Engineer"
                value={form.job_title}
                onChange={handleChange}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="company"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Company
              </label>
              <input
                id="company"
                type="text"
                name="company"
                placeholder="Acme Inc."
                value={form.company}
                onChange={handleChange}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Phone + show-in-vCard toggle */}
          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder="+44 7700 900000"
              value={form.phone}
              onChange={handleChange}
              className={inputClassName}
            />

            {/* Toggle: include this phone number in the .vcf contact file. */}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={form.show_phone}
                disabled={form.phone.trim().length === 0}
                onClick={() =>
                  setForm((prev) => ({ ...prev, show_phone: !prev.show_phone }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  form.show_phone
                    ? 'bg-(--main-orange)'
                    : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                aria-label="Show phone number on profile and in contact file"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.show_phone ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {form.phone.trim()
                  ? 'Show on profile and in contact file'
                  : 'Enter a number to enable'}
              </span>
              <InfoTip
                content="When ON, your phone number is shown publicly on your card and included in the .vcf contact file people download via Save Contact. When OFF (default), it stays private."
                side="top"
              />
            </div>
          </div>

          {/* Logo (Pro feature — locked at onboarding) */}
          <div>
            <label
              htmlFor="logo"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Logo{' '}
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                (Pro)
              </span>
            </label>
            <ProGate allowed={false} label="Logo upload">
              <input
                id="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoSelect}
                disabled
                className={inputClassName}
              />
            </ProGate>
          </div>

          {/* Bio — capped at 160 chars (matches the card's display limit). */}
          <div>
            <label
              htmlFor="bio"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              placeholder="What is something you want your clients to know about you?"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              maxLength={BIO_MAX_CHARS}
              className={inputClassName}
            />
            <p className="mt-1 text-right text-xs text-zinc-400 dark:text-zinc-500">
              {form.bio.length}/{BIO_MAX_CHARS}
            </p>
          </div>

          {/* ---- Social Links (dynamic) ---- */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Social Links
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  {socialLinks.length}/{maxLinks}
                </span>
              </label>
              <button
                type="button"
                onClick={addSocialLink}
                disabled={socialLinks.length >= maxLinks}
                className="flex cursor-pointer border border-(--main-orange) items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Link
              </button>
            </div>

            {/* Upgrade prompt when the free-tier link limit is reached */}
            {socialLinks.length >= maxLinks && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-(--main-orange)/30 bg-(--main-orange)/5 px-3 py-2 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Free limit reached ({maxLinks} links). Upgrade to Pro for up
                  to {PLAN_LIMITS.pro.maxSocialLinks} links.
                </span>
                <Link
                  href="/payment"
                  className="shrink-0 font-medium text-(--main-orange) hover:underline"
                >
                  Upgrade
                </Link>
              </div>
            )}

            <div className="scrollable-links flex min-h-10 max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {socialLinks.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  No links added yet — tap{' '}
                  <span className="font-medium">Add Link</span> to get started.
                </p>
              )}
              {socialLinks.map((link, index) => {
                const platform = SOCIAL_PLATFORMS.find(
                  (p) => p.id === link.platform,
                );
                const PlatformIcon = platform?.icon;
                return (
                  <div key={index} className="flex shrink-0 items-start gap-2">
                    {/* Platform dropdown (with icon prefix) */}
                    <div className="relative shrink-0">
                      {PlatformIcon && (
                        <PlatformIcon className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
                      )}
                      <select
                        value={link.platform}
                        onChange={(e) =>
                          handlePlatformChange(index, e.target.value)
                        }
                        className={`w-36 rounded-lg border border-zinc-300 bg-white py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${
                          PlatformIcon ? 'pl-8 pr-2' : 'px-2'
                        }`}
                      >
                        {SOCIAL_PLATFORMS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* URL / email input — email gets the right keyboard +
                        native validation so raw addresses pass the form. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        type={link.platform === 'email' ? 'email' : 'url'}
                        value={link.url}
                        onChange={(e) =>
                          updateSocialLink(index, 'url', e.target.value)
                        }
                        placeholder={platform?.placeholder ?? 'https://...'}
                        className={inputClassName}
                      />
                      {link.platform === 'other' && (
                        <input
                          type="text"
                          value={link.label ?? ''}
                          onChange={(e) =>
                            updateSocialLink(index, 'label', e.target.value)
                          }
                          maxLength={20}
                          placeholder='Link name (e.g. "My Shop") — shown on your card'
                          className={inputClassName}
                        />
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeSocialLink(index)}
                      className="mt-0.5 shrink-0 cursor-pointer rounded-md p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                      aria-label="Remove link"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referral code (optional) — pre-filled from a ?ref= link stash,
              editable for word-of-mouth codes. Attached fire-and-forget on
              submit; never blocks profile creation. */}
          <div>
            <label
              htmlFor="referralCode"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Referral code{' '}
              <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
                (optional)
              </span>
            </label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) =>
                setReferralCode(e.target.value.toUpperCase().slice(0, 25))
              }
              placeholder="e.g. VICTORK2QP9"
              autoComplete="off"
              maxLength={25}
              className={`${inputClassName} uppercase tracking-wide`}
            />
            {referralCheck === 'checking' && (
              <p className="mt-1 text-xs text-zinc-400">Checking code…</p>
            )}
            {referralCheck === 'valid' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Valid code
              </p>
            )}
            {referralCheck === 'invalid' && (
              <p className="mt-1 text-xs text-red-500">
                We couldn&apos;t find that code — check the spelling, or leave
                it empty.
              </p>
            )}
          </div>

          {/* Terms & Privacy consent — required before profile creation */}
          <div className="flex items-start gap-2">
            <input
              id="agreeToTerms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-(--main-orange) focus:ring-(--main-orange) dark:border-zinc-700"
            />
            <label
              htmlFor="agreeToTerms"
              className="text-xs text-zinc-600 dark:text-zinc-400"
            >
              I have read and accept the Konneqta{' '}
              <a
                href="/privacy"
                target="_blank"
                className="text-(--main-orange) hover:underline"
              >
                privacy policy
              </a>{' '}
              and{' '}
              <a
                href="/terms"
                target="_blank"
                className="text-(--main-orange) hover:underline"
              >
                terms of use
              </a>
            </label>
          </div>

          <button
            type="submit"
            disabled={
              loading || usernameStatus !== 'available' || !agreedToTerms
            }
            className="mt-4 flex w-full items-center justify-center gap-2 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading && (
              <Spinner size="sm" className="text-white dark:text-zinc-900" />
            )}
            {loading
              ? 'Creating profile...'
              : usernameStatus === 'idle'
                ? 'Enter a username to continue'
                : usernameStatus === 'checking'
                  ? 'Checking username...'
                  : usernameStatus === 'taken'
                    ? 'Username taken — pick another'
                    : usernameStatus === 'invalid' ||
                        usernameStatus === 'trailing-underscore'
                      ? 'Fix username to continue'
                      : usernameStatus === 'reserved'
                        ? 'That name is reserved'
                        : 'Create Profile'}
          </button>
        </form>
      </div>
    </main>
  );
}
