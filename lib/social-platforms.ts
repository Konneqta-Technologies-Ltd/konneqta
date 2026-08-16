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

export type SocialPlatform = {
  id: string;
  label: string;
  /** Compact label shown under the icon on the card back (defaults to label). */
  shortLabel?: string;
  placeholder: string;
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
    placeholder: "https://linkedin.com/in/you",
    icon: FaLinkedin,
  },
  {
    id: "github",
    label: "GitHub",
    placeholder: "https://github.com/you",
    icon: FaGithub,
  },
  {
    id: "twitter",
    label: "X (Twitter)",
    shortLabel: "X",
    placeholder: "https://x.com/you",
    icon: FaXTwitter,
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/you",
    icon: FaInstagram,
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@you",
    icon: FaYoutube,
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@you",
    icon: FaTiktok,
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/you",
    icon: FaFacebook,
  },
  {
    id: "reddit",
    label: "Reddit",
    placeholder: "https://reddit.com/user/you",
    icon: FaReddit,
  },
  {
    id: "telegram",
    label: "Telegram",
    placeholder: "https://t.me/you",
    icon: FaTelegram,
  },
  {
    id: "snapchat",
    label: "Snapchat",
    placeholder: "https://snapchat.com/add/you",
    icon: FaSnapchat,
  },
  {
    id: "wechat",
    label: "WeChat",
    placeholder: "https://...your-wechat-link",
    icon: FaWeixin,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/447700900000",
    icon: FaWhatsapp,
  },
  {
    id: "calendly",
    label: "Calendly",
    placeholder: "https://calendly.com/you",
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