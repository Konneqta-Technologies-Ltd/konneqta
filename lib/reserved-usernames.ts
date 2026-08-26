/**
 * Usernames that can never be claimed.
 *
 * Mirrors the reserved-slug list in supabase/phase4-multi-card.sql
 * (validate_card_slug) PLUS the additional Next.js route segments that share
 * the /<name> URL namespace (terms, privacy, contact, ...). A username taken
 * by a route would make the profile unreachable — /<name> would always render
 * the route, never the card — so blocking them client-side prevents dead-end
 * signups even where the DB trigger is more permissive.
 *
 * KEEP IN SYNC with the reserved list in validate_card_slug().
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // --- From the DB trigger (validate_card_slug) ---
  "edit",
  "api",
  "auth",
  "onboarding",
  "post-login",
  "admin",
  "konneqta",
  "vcard",
  "signature",
  "share",
  "settings",
  "offline",
  "manifest",
  "sw",
  "banners",
  "icons",
  "favicon.ico",
  "_next",
  "login",
  "signup",
  "forgot-password",
  // --- Next.js routes that also answer /<name> ---
  "terms",
  "privacy",
  "refund",
  "contact",
  "waitlist",
  "payment",
  "konneqts",
  "home",
  "reset-password",
  "verify-reset",
  "callback",
  "serwist",
  "referral",
]);

/** True when the username is reserved and must not be claimed. */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}