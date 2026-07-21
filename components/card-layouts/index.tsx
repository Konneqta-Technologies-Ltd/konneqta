/**
 * Card front-face layouts — one per theme `layout` key.
 *
 * Each layout is structurally different (not just recolored):
 * - Standard:  avatar top, dark info strip below, purple side panel
 * - Centered:  everything centered vertically, dark bg, no panel
 * - Split:     avatar left half, info right half (horizontal)
 * - Minimal:   name huge, role tiny, logo as corner mark, lots of whitespace
 * - BannerHero: banner image fills entire face, avatar overlaps bottom-center
 *
 * The flip-card BACK (social links + QR) is shared across all themes —
 * only its accent colors change. That lives in ProfileCard, not here.
 */

import Image from "next/image";
import type { ThemePreset } from "@/lib/themes";

/**
 * Resolve avatar border-radius from the theme's avatarShape customization.
 * Defaults to the layout's own styling when not set.
 */
function avatarRadius(shape: ThemePreset["avatarShape"], fallback = "50%"): string {
  if (shape === "square") return "4px";
  if (shape === "rounded") return "16px";
  if (shape === "circle") return "50%";
  return fallback;
}

export type CardLayoutProfile = {
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
};

export type CardLayoutProps = {
  profile: CardLayoutProfile;
  theme: ThemePreset;
  bannerUrl: string | null;
  /**
   * Flip handler. When omitted, the FlipButton is NOT rendered — used by
   * AppearanceModal's scaled-down previews (which are already inside a
   * <button>, and HTML forbids nested buttons → hydration error).
   */
  onFlip?: () => void;
};

const displayName = (p: CardLayoutProfile) => p.full_name || p.username;

/**
 * Fallback avatar used when a card has no avatar_url. Guaranteed to render
 * something sensible (the Konneqta default placeholder) instead of a blank
 * gap or a broken-image icon.
 */
const DEFAULT_AVATAR = "/default_avatar.png";

/** Resolve the avatar src, falling back to the default placeholder. */
const avatarSrc = (url: string | null) => url || DEFAULT_AVATAR;

/* ------------------------------------------------------------------ */
/* Flip button — shared, recolored per theme                           */
/* ------------------------------------------------------------------ */
function FlipButton({
  accent,
  onFlip,
  className = "",
}: {
  accent: string;
  onFlip?: () => void;
  className?: string;
}) {
  // When onFlip is undefined (preview mode inside AppearanceModal), render a
  // non-interactive <div> styled identically. This avoids nested-<button>
  // hydration errors while keeping the preview visually accurate.
  const sharedClass = `flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 ${className}`;
  const inner = (
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
  );

  if (!onFlip) {
    return (
      <div
        style={{ background: accent }}
        className={`${sharedClass} pointer-events-none opacity-90`}
        aria-hidden="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onFlip}
      style={{ background: accent }}
      className={`${sharedClass} cursor-pointer`}
      aria-label="Flip card"
    >
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 1. STANDARD — today's classic look                                  */
/* ------------------------------------------------------------------ */
export function StandardLayout({ profile, theme, onFlip }: CardLayoutProps) {
  const c = theme.colors;
  const name = displayName(profile);

  return (
    <>
      <div className="avatar relative overflow-hidden">
        <Image
          src={avatarSrc(profile.avatar_url)}
          alt={profile.username}
          width={290}
          height={290}
          priority
          className="h-56 max-w-65 object-cover"
          style={{ borderRadius: avatarRadius(theme.avatarShape, "0px") }}
          unoptimized
        />
        {/* Purple side panel */}
        <div
          className="absolute top-0 right-0 h-full w-20"
          style={{ background: c.panel, opacity: 0.7 }}
        />
      </div>

      <div
        className="w-65 rounded-b-3xl px-5 py-6"
        style={{ background: c.infoBg }}
      >
        <h1
          className="text-left text-lg font-medium"
          style={{ color: c.text, fontFamily: theme.fontFamily }}
        >
          {name}
        </h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-light" style={{ color: c.subtext }}>
              {profile.job_title}
            </p>
            <p className="text-sm font-medium" style={{ color: c.subtext }}>
              {profile.company}
            </p>
          </div>
          {profile.logo_url && (
            <Image
              src={profile.logo_url}
              alt={`${name} logo`}
              width={15}
              height={15}
              className="h-4 w-4 shrink-0 object-contain"
              unoptimized
            />
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="my-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {profile.bio}
        </p>
      )}

      <FlipButton accent={c.accent} onFlip={onFlip} className="mt-8" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. CENTERED — everything centered, dark theme                       */
/* ------------------------------------------------------------------ */
export function CenteredLayout({ profile, theme, onFlip }: CardLayoutProps) {
  const c = theme.colors;
  const name = displayName(profile);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
      <Image
        src={avatarSrc(profile.avatar_url)}
        alt={profile.username}
        width={120}
        height={120}
        priority
        className="h-28 w-28 object-cover ring-2"
        style={{ borderColor: c.accent, borderRadius: avatarRadius(theme.avatarShape) }}
        unoptimized
      />

      <div className="flex flex-col items-center gap-1">
        <h1
          className="text-center text-2xl font-semibold"
          style={{ color: c.text, fontFamily: theme.fontFamily }}
        >
          {name}
        </h1>
        {(profile.job_title || profile.company) && (
          <p className="text-center text-sm" style={{ color: c.subtext }}>
            {profile.job_title}
            {profile.job_title && profile.company ? " · " : ""}
            {profile.company}
          </p>
        )}
      </div>

      {profile.logo_url && (
        <Image
          src={profile.logo_url}
          alt={`${name} logo`}
          width={32}
          height={32}
          className="h-8 w-8 rounded object-contain"
          unoptimized
        />
      )}

      {profile.bio && (
        <p className="text-center text-xs" style={{ color: c.subtext }}>
          {profile.bio}
        </p>
      )}

      <FlipButton accent={c.accent} onFlip={onFlip} className="mt-4" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. SPLIT — avatar left, info right (horizontal)                     */
/* ------------------------------------------------------------------ */
export function SplitLayout({ profile, theme, onFlip }: CardLayoutProps) {
  const c = theme.colors;
  const name = displayName(profile);

  return (
    <div className="flex h-full w-full items-center gap-4 px-5">
      {/* Left: avatar */}
      <div className="flex w-2/5 justify-center">
        <Image
          src={avatarSrc(profile.avatar_url)}
          alt={profile.username}
          width={140}
          height={140}
          priority
          className="h-32 w-32 rounded-2xl object-cover"
          unoptimized
        />
      </div>

      {/* Right: info */}
      <div className="flex w-3/5 flex-col gap-2">
        {profile.logo_url && (
          <Image
            src={profile.logo_url}
            alt={`${name} logo`}
            width={28}
            height={28}
            className="h-7 w-7 rounded object-contain"
            unoptimized
          />
        )}
        <h1 className="text-left text-xl font-bold" style={{ color: c.text, fontFamily: theme.fontFamily }}>
          {name}
        </h1>
        {profile.job_title && (
          <p className="text-sm" style={{ color: c.accent }}>
            {profile.job_title}
          </p>
        )}
        {profile.company && (
          <p className="text-sm" style={{ color: c.subtext }}>
            {profile.company}
          </p>
        )}
        {profile.bio && (
          <p className="mt-1 text-xs" style={{ color: c.subtext }}>
            {profile.bio}
          </p>
        )}
        <FlipButton accent={c.accent} onFlip={onFlip} className="mt-2 self-start" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. MINIMAL — huge name, tiny role, logo as corner mark             */
/* ------------------------------------------------------------------ */
export function MinimalLayout({ profile, theme, onFlip }: CardLayoutProps) {
  const c = theme.colors;
  const name = displayName(profile);

  return (
    <div className="relative flex h-full w-full flex-col justify-end px-8 pb-12">
      {/* Logo as corner mark, top-right */}
      {profile.logo_url && (
        <Image
          src={profile.logo_url}
          alt={`${name} logo`}
          width={24}
          height={24}
          className="absolute top-6 right-6 h-6 w-6 rounded object-contain"
          unoptimized
        />
      )}

      {/* Avatar tiny, top-left */}
      <Image
        src={avatarSrc(profile.avatar_url)}
        alt={profile.username}
        width={48}
        height={48}
        priority
        className="absolute top-6 left-8 h-12 w-12 rounded-full object-cover"
        unoptimized
      />

      {/* Name huge at the bottom */}
      <div className="flex flex-col gap-1">
        <h1
          className="text-left text-3xl font-bold leading-tight"
          style={{ color: c.text, fontFamily: theme.fontFamily }}
        >
          {name}
        </h1>
        {profile.job_title && (
          <p className="text-xs uppercase tracking-widest" style={{ color: c.subtext }}>
            {profile.job_title}
            {profile.company ? ` · ${profile.company}` : ""}
          </p>
        )}
      </div>

      {profile.bio && (
        <p className="mt-3 max-w-xs text-sm" style={{ color: c.subtext }}>
          {profile.bio}
        </p>
      )}

      <FlipButton accent={c.accent} onFlip={onFlip} className="mt-6 self-start" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. BANNER HERO — banner fills face, avatar overlaps bottom-center   */
/* ------------------------------------------------------------------ */
export function BannerHeroLayout({ profile, theme, bannerUrl, onFlip }: CardLayoutProps) {
  const c = theme.colors;
  const name = displayName(profile);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      {/* Banner background (z-0) */}
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: c.bg }} />
      )}

      {/* Legibility overlay (z-10) — gradient transparent→dark */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, transparent 30%, ${c.overlay} 100%)`,
        }}
      />

      {/* Content (z-20) */}
      <div className="relative z-20 flex h-full flex-col items-center justify-end pb-10">
        {/* Avatar overlapping */}
        <Image
          src={avatarSrc(profile.avatar_url)}
          alt={profile.username}
          width={100}
          height={100}
          priority
          className="mb-3 h-24 w-24 rounded-full border-4 object-cover"
          style={{ borderColor: c.bg === "#000000" ? "#ffffff" : c.bg }}
          unoptimized
        />

        <h1 className="text-center text-2xl font-bold" style={{ color: c.text, fontFamily: theme.fontFamily }}>
          {name}
        </h1>

        {(profile.job_title || profile.company) && (
          <p className="text-center text-sm" style={{ color: c.subtext }}>
            {profile.job_title}
            {profile.job_title && profile.company ? " · " : ""}
            {profile.company}
          </p>
        )}

        {profile.logo_url && (
          <Image
            src={profile.logo_url}
            alt={`${name} logo`}
            width={28}
            height={28}
            className="mt-2 h-7 w-7 rounded object-contain"
            unoptimized
          />
        )}

        {profile.bio && (
          <p className="mt-2 max-w-xs text-center text-xs" style={{ color: c.subtext }}>
            {profile.bio}
          </p>
        )}

        <FlipButton accent={c.accent} onFlip={onFlip} className="mt-4" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SWITCHER — picks the layout based on the theme's layout key         */
/* ------------------------------------------------------------------ */
export function renderCardFront(props: CardLayoutProps): React.ReactElement {
  switch (props.theme.layout) {
    case "standard":
      return <StandardLayout {...props} />;
    case "centered":
      return <CenteredLayout {...props} />;
    case "split":
      return <SplitLayout {...props} />;
    case "minimal":
      return <MinimalLayout {...props} />;
    case "banner-hero":
      return <BannerHeroLayout {...props} />;
    default:
      return <StandardLayout {...props} />;
  }
}