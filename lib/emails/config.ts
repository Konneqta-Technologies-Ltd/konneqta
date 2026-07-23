/**
 * Central email configuration — brand constants + sender addresses.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 * - Brand colors (purple, orange, black, white) used in all email templates.
 * - The logo URL (must be publicly accessible — email clients can't read
 *   local files).
 * - Sender addresses per purpose (receipts, info, security). Each "from"
 *   address must be a verified sender in ZeptoMail.
 *
 * SECURITY
 * --------
 * Sender addresses are server-side env vars (no NEXT_PUBLIC_ prefix). They're
 * never exposed to the browser.
 */

// =============================================================================
// BRAND COLORS
// =============================================================================
// These match the Konneqta card theme palette (see lib/themes.ts).
export const BRAND_COLORS = {
  purple: "#7751b8",
  orange: "#FF6B2C",
  black: "#101010",
  white: "#FAFAFA",
  // Supporting shades
  purpleLight: "#9d72d4",
  purpleDark: "#5a3d8f",
  orangeLight: "#FF8559",
  grayDark: "#3f3f46",
  grayMid: "#71717a",
  grayLight: "#f4f4f5",
  grayBorder: "#e4e4e7",
} as const;

// =============================================================================
// LOGO
// =============================================================================
// Email clients load images from public URLs. Use NEXT_PUBLIC_SITE_URL so this
// works in both dev (localhost) and production. The logo must be in /public/.
// k-white.png is used on dark headers, k-dark.png on light backgrounds.
export function getLogoUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://konneqta.com";
  return `${baseUrl}/konneqta-logo.png`;
}

export function getLogoDarkUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://konneqta.com";
  return `${baseUrl}/konneqta-logo.png`;
}

// =============================================================================
// SENDER ADDRESSES (per purpose)
// =============================================================================
/**
 * Each email purpose uses a dedicated "from" address so users always know
 * who they're hearing from:
 *
 * - "receipts"  → receipts@konneqta.com  (payment receipts, transaction emails)
 * - "info"      → info@konneqta.com      (general announcements, onboarding)
 * - "admin"     → admin@konneqta.com     (internal admin notifications)
 * - "security"  → security@konneqta.com  (password reset OTPs, auth alerts)
 *
 * All addresses must be verified sender domains in ZeptoMail.
 */
export type EmailSenderType = "receipts" | "info" | "admin" | "security";

type SenderConfig = {
  address: string;
  name: string;
};

/** Resolve a sender type to its { address, name } from environment variables. */
export function getSender(type: EmailSenderType): SenderConfig {
  const envKey = `EMAIL_SENDER_${type.toUpperCase()}`;
  const address = process.env[envKey];

  if (!address) {
    console.warn(
      `[emails] ${envKey} is not set — falling back to default sender.`
    );
    // Fallback to the info address so the email still sends.
    return {
      address: process.env.EMAIL_SENDER_INFO || "noreply@konneqta.com",
      name: "Konneqta",
    };
  }

  const names: Record<EmailSenderType, string> = {
    receipts: "Konneqta Receipts",
    info: "Konneqta",
    admin: "Konneqta Admin",
    security: "Konneqta Security",
  };

  return { address, name: names[type] };
}