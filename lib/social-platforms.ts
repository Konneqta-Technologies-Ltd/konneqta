import {
  FaEnvelope,
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLink,
  FaLinkedin,
  FaReddit,
  FaSnapchat,
  FaTelegram,
  FaTiktok,
  FaWeixin,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

import type { IconType } from "react-icons";
import { SiCalendly } from "react-icons/si";
import { TbWorld } from "react-icons/tb";

import { isSafeEmailValue, isSafeHttpUrl } from "@/lib/url-validation";

export type SocialPlatform = {
  id: string;
  label: string;
  /** Compact label shown under the icon on the card back (defaults to label). */
  shortLabel?: string;
  placeholder: string;
  /**
   * Official base URL prepended when the user enters a shorthand handle
   * ("@handle" or bare "handle") instead of a full link — e.g.
   * "https://www.instagram.com/" + "emeka" → "https://www.instagram.com/emeka".
   * Domain-pinned: the handle is charset-sanitized, so shorthand links can
   * only ever point at the real platform. Absent → a full https:// URL is
   * required (website / custom link / WeChat).
   */
  urlPrefix?: string;
  /** Brand glyph from react-icons (falls back to a globe for web/unknown). */
  icon: IconType;
};

/**
 * Catalogue of platforms users can attach to their profile.
 * Order here is the order shown in the onboarding dropdown.
 */
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "website",
    label: "My Website",
    shortLabel: "Website",
    placeholder: "https://your-site.com",
    icon: TbWorld,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "@yourhandle — or paste a full link",
    urlPrefix: "https://www.linkedin.com/in/",
    icon: FaLinkedin,
  },
  {
    id: "github",
    label: "GitHub",
    placeholder: "@yourhandle — or paste a full link",
    urlPrefix: "https://github.com/",
    icon: FaGithub,
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    shortLabel: "X",
    placeholder: "@yourhandle — or paste a full link",
    urlPrefix: "https://x.com/",
    icon: FaXTwitter,
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@yourhandle — or paste a full link",
    urlPrefix: "https://www.instagram.com/",
    icon: FaInstagram,
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "@yourhandle — or paste a full link",
    // Handles live at youtube.com/@handle — the '@' is part of the path.
    // Legacy /c/, /user/, /channel/ URLs still work via full-link paste.
    urlPrefix: "https://www.youtube.com/@",
    icon: FaYoutube,
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "@yourhandle — or paste a full link",
    urlPrefix: "https://www.tiktok.com/@",
    icon: FaTiktok,
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "@yourname — or paste a full link",
    urlPrefix: "https://www.facebook.com/",
    icon: FaFacebook,
  },
  {
    id: "reddit",
    label: "Reddit",
    placeholder: "@username — or paste a full link",
    urlPrefix: "https://www.reddit.com/user/",
    icon: FaReddit,
  },
  {
    id: "telegram",
    label: "Telegram",
    placeholder: "@username — or paste a full link",
    urlPrefix: "https://t.me/",
    icon: FaTelegram,
  },
  {
    id: "snapchat",
    label: "Snapchat",
    placeholder: "@username — or paste a full link",
    urlPrefix: "https://www.snapchat.com/add/",
    icon: FaSnapchat,
  },
  {
    id: "wechat",
    label: "WeChat",
    // No public profile-URL scheme → shorthand unavailable, full link only.
    placeholder: "https://...your-wechat-link",
    icon: FaWeixin,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    // wa.me links take the number WITHOUT the '+' (official format):
    // "+234 801 234 5678" → "https://wa.me/2348012345678".
    placeholder: "+234 801 234 5678 — or paste a wa.me link",
    icon: FaWhatsapp,
  },
  {
    id: "calendly",
    label: "Calendly",
    placeholder: "@yourname — or paste a full link",
    urlPrefix: "https://calendly.com/",
    icon: SiCalendly,
  },
  {
    id: "email",
    label: "Email",
    placeholder: "you@email.com",
    icon: FaEnvelope,
  },
  {
    id: "other",
    label: "Custom Link",
    shortLabel: "Link",
    placeholder: "https://...",
    icon: FaLink,
  },
];

export const PLATFORM_MAP: Record<string, SocialPlatform> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p])
);

/**
 * Allowlist for shorthand handles: letters, digits, dots, underscores,
 * hyphens — 1–64 chars. Everything else (slashes, '?', '#', '=', spaces,
 * '%', …) is rejected, so a shorthand can NEVER smuggle a path, query, or
 * scheme past the platform prefix. This is what makes "@handle" links the
 * SAFEST links on the card: they are domain-pinned to the official platform.
 */
const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Resolve what the user typed for a social link into the canonical value to
 * STORE (always a full https:// URL — except email, which stays a raw
 * address so it satisfies the DB CHECK constraint and mailto: rendering).
 *
 * Accepted inputs per platform:
 * - Full https?:// URL            → kept as-is after the http(s)-only safety
 *                                   check (works for EVERY platform — pasted
 *                                   links like facebook.com/profile.php?id=…
 *                                   or YouTube /c/… still work).
 * - "@handle" / bare "handle"     → platform.urlPrefix + sanitized handle
 *                                   (only for platforms defining urlPrefix).
 * - WhatsApp "+234 801 234 5678"
 *   (any spacing/dashes)          → https://wa.me/2348012345678 — the '+'
 *                                   and formatting are stripped (wa.me's
 *                                   official format takes bare digits, and a
 *                                   leading 0 (local-only number) is rejected
 *                                   since it can never resolve).
 * - Email                         → raw address kept (mailto: is added at
 *                                   render time by safeHref).
 *
 * Returns null when the input can't be resolved safely — callers must skip
 * the row AND tell the user (never drop silently).
 */
export function resolveSocialLinkInput(
  platformId: string,
  raw: string
): string | null {
  const input = raw.trim();
  if (!input) return null;

  // Email keeps its raw-address form; isSafeEmailValue blocks dangerous
  // schemes (javascript:, data:, …) as before.
  if (platformId === "email") {
    return isSafeEmailValue(input) ? input : null;
  }

  // Full URL passthrough — one uniform rule for every platform. The scheme
  // gate (http/https ONLY) is the XSS barrier for pasted links.
  if (/^https?:\/\//i.test(input)) {
    return isSafeHttpUrl(input) ? input : null;
  }

  // WhatsApp shorthand: a phone number in international format.
  if (platformId === "whatsapp") {
    const digits = input.replace(/\D/g, "");
    // E.164: 8–15 digits; country codes never start with 0, so a number
    // that does is local-only and unusable as a wa.me link.
    if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) {
      return null;
    }
    return `https://wa.me/${digits}`;
  }

  // Handle shorthand for platforms with a known profile-URL prefix:
  // "@yourhandle" or "yourhandle" → prefix + sanitized handle (domain-pinned).
  const platform = PLATFORM_MAP[platformId];
  if (platform?.urlPrefix) {
    const handle = input.replace(/^@/, "").trim();
    return HANDLE_RE.test(handle) ? platform.urlPrefix + handle : null;
  }

  // No shorthand for this platform (website / custom link / WeChat):
  // a full https:// URL is required.
  return null;
}