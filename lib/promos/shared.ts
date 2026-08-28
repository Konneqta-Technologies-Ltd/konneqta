/**
 * Promo codes — shared (client + server safe) helpers.
 *
 * A promo code grants free Premium DAYS (no discounts, no payment changes).
 * Everything that decides eligibility/granting lives in the DB RPC
 * `redeem_promo` (supabase/promo-codes-setup.sql) — this file only shapes
 * user input and displays results.
 */

/** Codes are uppercase letters/digits/underscore, 3–30 chars (matches the DB). */
export const PROMO_CODE_PATTERN = /^[A-Z0-9_]{3,30}$/;

/** Normalize user input: trim, uppercase. Friendly to "welcome30 " or pasted text. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 30);
}

/** Shape check before hitting the network (cheap garbage rejection). */
export function isPlausiblePromoCode(raw: string): boolean {
  return PROMO_CODE_PATTERN.test(normalizePromoCode(raw));
}
