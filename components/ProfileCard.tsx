'use client';

import { ThemeCustomization, resolveTheme } from '@/lib/themes';

import AppearanceModal from './AppearanceModal';
import ConnectButton from './connect/ConnectButton';
import Image from 'next/image';
import { KONNEQT_SOURCES } from '@/lib/konneqts';
import { PLATFORM_MAP } from '@/lib/social-platforms';
import PaymentOptionsModal from './PaymentOptionsModal';
import ShareMenu from './ShareMenu';
import ShowcaseViewerModal from './showcase/ShowcaseViewerModal';
import type { ShowcaseItem } from '@/lib/showcase';
import Spinner from './ui/Spinner';
import Tooltip from './Tooltip';
import { createClient } from '@/lib/supabase/client';
import { regenerateQrCode } from '@/lib/qr';
import { renderCardFront } from './card-layouts';
import { safeHref } from '@/lib/url-validation';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { track } from '@/lib/track';
import { FLIP_CARD_EVENT, OPEN_VISITOR_TOUR_EVENT } from '@/lib/onboarding';

type SocialLink = {
  platform: string;
  url: string;
  /** Optional custom display name (set for "Custom Link" entries). */
  label?: string | null;
};

type Profile = {
  id: string;
  cardId?: string;
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  qr_code_url: string | null;
  theme: string | null;
  banner_url: string | null;
  theme_custom: ThemeCustomization | null;
};

/** Circular icon button shared by the card's action row. */
function IconButton({
  href,
  onClick,
  label,
  tourTarget,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  tourTarget?: string;
  children: React.ReactNode;
}) {
  const className =
    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800';

  const content = href ? (
    <a
      href={href}
      aria-label={label}
      className={className}
      data-tour={tourTarget}
    >
      {children}
    </a>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={className}
      data-tour={tourTarget}
    >
      {children}
    </button>
  );

  return (
    <Tooltip label={label} side="bottom">
      {content}
    </Tooltip>
  );
}

export default function ProfileCard({
  profile,
  socialLinks,
  showcaseItems = [],
  linkLimit = Infinity,
  hiddenShowcaseCount = 0,
  isOwner = false,
  canUseThemes = false,
  canUseBanners = false,
}: {
  profile: Profile;
  socialLinks: SocialLink[];
  /** Owner's showcase items — visitors get a trigger under the copy-link
   *  row that opens them in a view-only modal. Empty = no trigger. Already
   *  display-capped by the server to the owner's current tier. */
  showcaseItems?: ShowcaseItem[];
  /**
   * How many social links stay ACTIVE (openable). Links beyond this index
   * render DEACTIVATED — dimmed, unclickable, padlocked — when the owner's
   * subscription has lapsed (free = 3). Nothing is deleted: the stored rows
   * stay intact and renewing Pro reactivates them automatically.
   * Infinity (default) = every link is active.
   */
  linkLimit?: number;
  /** Showcase items beyond the owner's current tier cap. Surfaced as a
   *  "🔒 N more with Pro" hint on the showcase trigger (visitors only). */
  hiddenShowcaseCount?: number;
  isOwner?: boolean;
  canUseThemes?: boolean;
  canUseBanners?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  // Product tour: let the tour flip/unflip the card programmatically (e.g.
  // before spotlighting the QR code on the back for visitors and owners).
  useEffect(() => {
    const handler = (e: Event) => {
      setFlipped(
        Boolean((e as CustomEvent<{ flipped: boolean }>).detail?.flipped),
      );
    };
    window.addEventListener(FLIP_CARD_EVENT, handler);
    return () => window.removeEventListener(FLIP_CARD_EVENT, handler);
  }, []);
  const [showShowcase, setShowShowcase] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Owner-only upgrade modal for reactivating lapsed (inactive) links.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const router = useRouter();

  // How many stored links render deactivated (beyond the owner's active
  // tier cap). Zero for Pro/exempt owners and whenever the link count fits
  // within the cap.
  const inactiveLinkCount =
    linkLimit === Infinity
      ? 0
      : Math.max(0, socialLinks.length - linkLimit);

  // ── ANALYTICS: social-link clicks ─────────────────────────────────
  // Fire-and-forget beacon to /api/track/link-click. The server re-checks
  // owner/bot/cross-origin, so this can't be used to inflate counts; the
  // owner's own clicks are skipped here to avoid a pointless request.
  // sendBeacon never blocks the navigation; the keepalive fetch is a
  // fallback for browsers without sendBeacon.
  const trackLinkClick = (platform: string) => {
    if (isOwner) return;
    try {
      const payload = JSON.stringify({ username: profile.username, platform });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/track/link-click',
          new Blob([payload], { type: 'application/json' }),
        );
      } else if (typeof fetch !== 'undefined') {
        void fetch('/api/track/link-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let analytics interfere with the click.
    }
  };

  // Refresh/regenerate the card's QR code (owner-only). Generates a fresh
  // PNG, uploads to the qrcodes bucket, and updates qr_code_url — then
  // refreshes the Server Component data without a full page reload.
  const handleRefreshQr = async () => {
    if (refreshing) return; // prevent double-clicks
    setRefreshing(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to refresh your card.');
        return;
      }
      if (!profile.cardId) {
        toast.error("Card ID missing — can't refresh QR.");
        return;
      }
      // LOGO-IN-QR IS PRO-ONLY. profile.logo_url is entitlement-gated
      // server-side (app/[username]/page.tsx nulls it when the owner's Pro
      // has lapsed), so passing it here bakes the logo ONLY while the owner
      // is actually Pro. (This used to re-read the raw cards.logo_url so a
      // lapsed-Pro owner's QR kept the old logo — that policy is reversed:
      // non-Pro cards get a plain, logo-free QR.)
      await regenerateQrCode({
        supabase,
        userId: user.id,
        cardId: profile.cardId,
        cardSlug: profile.username,
        logoUrl: profile.logo_url ?? null,
        onLogoFailed: (reason) => {
          console.warn('QR refresh logo embedding failed:', reason);
          toast.warning(
            "QR refreshed, but your logo couldn't be embedded in it. Please try again.",
          );
        },
      });
      toast.success('QR code refreshed');
      router.refresh();
    } catch (err) {
      console.error('QR refresh failed:', err);
      toast.error("Couldn't refresh the QR code. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const theme = resolveTheme(profile.theme, profile.theme_custom);
  const c = theme.colors;
  const displayName = profile.full_name || profile.username;

  // Compute the absolute profile URL lazily at click-time (client-only).
  const getProfileUrl = () =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/${profile.username}`
      : `/${profile.username}`;

  const handleCopy = async () => {
    const profileUrl = getProfileUrl();
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = profileUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    track('profile_link_copied', { username: profile.username });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="w-full max-w-sm"
      data-tour={isOwner ? 'owner-card' : undefined}
    >
      {/* ---- Flip card ---- */}
      <div style={{ height: 500, perspective: '1200px' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ---------- FRONT ---------- */}
          {/*
            FLIP-BUG FIX: The front face MUST have an explicit identity
            transform (rotateY(0deg)), overflow:hidden, and pointer-events
            toggling. Without these, child elements (especially in the
            BannerHero layout which uses absolute-positioned <img>/z-index
            layers) "bleed through" the back when flipped and capture clicks,
            making it impossible to flip back. backface-visibility:hidden on
            the parent alone is insufficient for nested 3D content.
          */}
          <div
            className="flex flex-col items-center justify-center overflow-hidden rounded-3xl border p-8 text-center shadow-sm"
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: c.bg,
              transform: 'rotateY(0deg)',
              pointerEvents: flipped ? 'none' : 'auto',
              zIndex: flipped ? 0 : 1,
            }}
          >
            {/*
              The front-face layout is now delegated to the theme's layout
              key (see components/card-layouts). Each layout is structurally
              different, not just recolored.
            */}
            {renderCardFront({
              profile: {
                username: profile.username,
                full_name: profile.full_name,
                job_title: profile.job_title,
                company: profile.company,
                phone: profile.phone,
                bio: profile.bio,
                avatar_url: profile.avatar_url,
                logo_url: profile.logo_url,
              },
              theme,
              bannerUrl: profile.banner_url,
              onFlip: () => setFlipped(true),
            })}
          </div>

          {/* ---------- BACK ---------- */}
          <div
            // The card back is intentionally theme-mode independent. It
            // keeps the same dark surface and white icons in both light and
            // dark app modes; only the surrounding app chrome changes.
            data-tour="card-back"
            className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm"
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="scrollable-links flex min-h-0 flex-1 flex-wrap content-start justify-center gap-3 overflow-y-auto pr-1">
              {socialLinks.length === 0 ? (
                <p className="text-center text-sm text-zinc-400">
                  No links added yet.
                </p>
              ) : (
                socialLinks.map((link, index) => {
                  const platform = PLATFORM_MAP[link.platform];
                  const Icon = platform?.icon;
                  const label = platform?.label ?? link.platform;
                  // Caption under the icon: user's custom name (Custom Link)
                  // → compact platform name → full label.
                  const shortLabel =
                    (link.platform === 'other' && link.label?.trim()) ||
                    platform?.shortLabel ||
                    label;
                  const isEmail = link.platform === 'email';
                  const href = safeHref(link.url, isEmail);
                  if (!href) return null;

                  // INACTIVE LINK (subscription expired / over the free cap):
                  // stored but deactivated — dimmed, padlocked, NOT clickable.
                  // The URL stays safely in the DB; renewing Pro flips this
                  // straight back to the active branch below.
                  if (index >= linkLimit) {
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (isOwner) {
                            toast.warning(
                              `${inactiveLinkCount} of your links are inactive — upgrade to Pro to wake them up.`,
                            );
                            setUpgradeOpen(true);
                          } else {
                            toast('This link is inactive right now.');
                          }
                        }}
                        aria-label={`${label} (inactive)`}
                        className="group flex w-14 cursor-not-allowed flex-col items-center gap-1 opacity-40 grayscale"
                      >
                        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-50">
                          {Icon ? (
                            <Icon className="h-5 w-5" />
                          ) : (
                            <span className="text-xs font-medium uppercase">
                              {label.charAt(0)}
                            </span>
                          )}
                          {/* Tiny padlock — "stored, but deactivated" */}
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900/90 text-white ring-1 ring-white/20 dark:bg-zinc-100/90 dark:text-zinc-900">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                        </span>
                        <span className="max-w-14 truncate text-[10px] text-zinc-500">
                          {shortLabel}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <a
                      key={index}
                      href={href}
                      // mailto: opens the mail client — a new tab would be
                      // left sitting empty, so only web links get _blank.
                      {...(isEmail
                        ? {}
                        : { target: '_blank', rel: 'noopener noreferrer' })}
                      onClick={() => trackLinkClick(link.platform)}
                      aria-label={label}
                      className="group flex w-14 flex-col items-center gap-1"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-50 transition-colors group-hover:border-zinc-600 group-hover:bg-zinc-800">
                        {Icon ? (
                          <Icon className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-medium uppercase">
                            {label.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="max-w-14 truncate text-[10px] text-zinc-400">
                        {shortLabel}
                      </span>
                    </a>
                  );
                })
              )}
            </div>

            {/* INACTIVE LINKS: the owner's subscription lapsed, so links
                beyond their tier cap render deactivated above. This amber
                chip explains why — owners tap it to upgrade, visitors just
                get context. Zero links are ever deleted. */}
            {inactiveLinkCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (isOwner) {
                    setUpgradeOpen(true);
                  } else {
                    toast('Some links are inactive on this card.');
                  }
                }}
                className="mx-auto mt-2 flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {inactiveLinkCount} link{inactiveLinkCount === 1 ? '' : 's'} inactive
                {isOwner ? ' · Upgrade to Pro' : ''}
              </button>
)}

            {/* ---- QR Code (back of card) ---- */}
            {profile.qr_code_url ? (
              <div className=" flex flex-col items-center mx-auto w-44 h-44 relative">
                <Image
                  src={profile.qr_code_url}
                  alt={`Scan to view ${displayName}'s profile`}
                  fill
                  // Fixed 176px slot (w-44 h-44) — without `sizes`, Next
                  // builds the srcset from deviceSizes (viewport-wide) and
                  // browsers fetch oversized variants of this PNG.
                  sizes="176px"
                  // Non-Pro owners are served a freshly generated plain QR
                  // as a data URL (logo-in-QR is Pro-only). Data URLs bypass
                  // the image optimizer — mark them unoptimized explicitly.
                  unoptimized={profile.qr_code_url.startsWith("data:")}
                  className=" rounded-lg border border-zinc-800 bg-white object-contain"
                />
                <p className="mt-1 text-[10px] text-zinc-400">
                  Scan to connect
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="mt-4 mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: c.accent }}
              aria-label="Flip card back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Bottom action area (icons + copy link, centered) ---- */}
      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {isOwner && (
            <IconButton
              href={`/${profile.username}/edit`}
              label="Edit Profile"
              tourTarget="edit-card"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
              </svg>
            </IconButton>
          )}

          {/* New Card (owner only) — quick access to create another identity */}
          {isOwner && (
            <IconButton
              href={`/${profile.username}/edit`}
              label="Add new card"
              tourTarget="add-card"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </IconButton>
          )}

          {/* Customize (owner only) — opens the Appearance modal */}
          {isOwner && (
            <IconButton
              label="Customize card"
              onClick={() => setShowAppearance(true)}
              tourTarget="customize-card"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </IconButton>
          )}

          {/* Refresh QR (owner only) — regenerates the QR code PNG and
              refreshes the card data without a full page reload. Useful
              when the QR failed to generate during onboarding. */}
          {isOwner && (
            <Tooltip label="Refresh QR code" side="bottom">
              <button
                type="button"
                onClick={handleRefreshQr}
                disabled={refreshing}
                aria-label="Refresh QR code"
                data-tour="refresh-qr"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {refreshing ? (
                  <Spinner size="sm" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                )}
              </button>
            </Tooltip>
          )}

          {/* Save Contact — visitors only. The owner doesn't need to save
              their own card. */}
          {!isOwner && (
            <IconButton
              href={`/${profile.username}/vcard`}
              label="Save Contact"
              tourTarget="save-contact"
              onClick={() =>
                track('contact_saved', { username: profile.username })
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 2v4a2 2 0 0 0 2 2h4" />
                <path d="M3.27 6.96 12 12.01l8.73-5.05" />
                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5Z" />
                <path d="M8 14h.01M12 14h.01M16 14h.01" />
              </svg>
            </IconButton>
          )}

          {/* Connect — visitors only. Creates a Konneqt (logged-in) or opens
              the guest form (anonymous). Sits between Save Contact and Share. */}
          {!isOwner && (
            <span data-tour="connect">
              <ConnectButton
                targetUsername={profile.username}
                targetDisplayName={displayName}
                source={KONNEQT_SOURCES.PROFILE_PAGE}
              />
            </span>
          )}

          <Tooltip label="Share" side="top">
            <span data-tour="share-card">
              <ShareMenu
                username={profile.username}
                title={displayName}
                cardId={profile.cardId}
                isOwner={isOwner}
              />
            </span>
          </Tooltip>

          {/* Card help — visitors only. Replays the visitor product tour
              (styled like the other circular icon buttons in this row). */}
          {!isOwner && (
            <IconButton
              label="How to use this card"
              onClick={() =>
                window.dispatchEvent(new Event(OPEN_VISITOR_TOUR_EVENT))
              }
            >
              <span aria-hidden="true" className="text-sm font-bold">
                ?
              </span>
            </IconButton>
          )}
        </div>

        <Tooltip label={copied ? 'Copied!' : 'Copy link'} side="top">
          <button
            type="button"
            onClick={handleCopy}
            data-tour="copy-link"
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-green-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
            www.konneqta.com/@{profile.username}
          </button>
        </Tooltip>

        {/* Showcase trigger — VISITORS ONLY (the owner manages their
            showcase from the sidenav page at /[username]/showcase). Placed
            on the page under the copy-link row, not on the flip card.
            Renders only when the owner has at least one item; the count
            badge sets visitor expectations and lifts taps. */}
        {!isOwner && showcaseItems.length > 0 && (
          <div className="mt-4 flex w-full justify-center">
            <button
              type="button"
              onClick={() => setShowShowcase(true)}
              data-tour="showcase-trigger"
              className="flex cursor-pointer items-center gap-2 rounded-full bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
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
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Showcase · {showcaseItems.length}{' '}
              {showcaseItems.length === 1 ? 'item' : 'items'}
              {hiddenShowcaseCount > 0
                ? ` · 🔒 ${hiddenShowcaseCount} more with Pro`
                : ''}
            </button>
          </div>
        )}
      </div>

      {/* ---- Showcase viewer modal (visitors only) ---- */}
      {!isOwner && showcaseItems.length > 0 && (
        <ShowcaseViewerModal
          open={showShowcase}
          onClose={() => setShowShowcase(false)}
          items={showcaseItems}
          ownerName={displayName}
        />
      )}

      {/* ---- Upgrade modal (owner tapped an inactive link / amber chip) ---- */}
      {isOwner && (
        <PaymentOptionsModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
        />
      )}

      {/* ---- Appearance modal (owner only) ---- */}
      {isOwner && (
        <AppearanceModal
          open={showAppearance}
          onClose={() => {
            setShowAppearance(false);
            router.refresh();
          }}
          profile={{
            username: profile.username,
            full_name: profile.full_name,
            job_title: profile.job_title,
            company: profile.company,
            phone: profile.phone,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            logo_url: profile.logo_url,
          }}
          currentThemeId={profile.theme ?? 'classic'}
          currentBannerUrl={profile.banner_url}
          canUseThemes={canUseThemes}
          canUseBanners={canUseBanners}
          ownerId={profile.id}
          cardId={profile.cardId}
          initialCustom={profile.theme_custom}
        />
      )}
    </div>
  );
}
