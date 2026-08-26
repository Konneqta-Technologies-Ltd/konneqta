/**
 * Referral system — shared (client + server safe) helpers.
 *
 * Pure functions + localStorage plumbing only. Anything touching the service
 * role / DB writes lives in lib/referrals/service.ts (server-only).
 *
 * The localStorage stash exists because a referral code has to SURVIVE the
 * gap between landing on /auth/signup?ref=CODE and completing onboarding:
 *   signup → (email confirmation link / Google OAuth) → auth/callback →
 *   onboarding → profile INSERT → POST /api/referrals/attach
 * Cookies aren't reliably available pre-signup, so localStorage bridges it.
 */

/** localStorage key for the stashed referral code (see lib/offline patterns). */
export const REFERRAL_STORAGE_KEY = "kq_referral_code";

/**
 * Minimum plausible code length: 1-char name prefix + 5 random chars.
 * Used to cheaply reject garbage before hitting the network.
 */
export const MIN_REFERRAL_CODE_LENGTH = 6;

/**
 * Normalize a code the way the DB generates/stores them:
 * uppercase, alphanumeric only, capped at the max generated length (25).
 *
 * Friendly to users who type "victor-k2qp9" or paste with whitespace —
 * normalization happens on every boundary (client check, attach API).
 */
export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 25);
}

/** Build the shareable signup link for a code. */
export function buildReferralLink(code: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/signup?ref=${code}`;
}

/** Read the stashed code (normalized), or null. Never throws. */
export function readStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const code = normalizeReferralCode(raw);
    return code.length >= MIN_REFERRAL_CODE_LENGTH ? code : null;
  } catch {
    return null;
  }
}

/** Stash a code for the signup → onboarding journey. Never throws. */
export function storeReferralCode(code: string): void {
  try {
    const normalized = normalizeReferralCode(code);
    if (normalized.length >= MIN_REFERRAL_CODE_LENGTH) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
    }
  } catch {
    // localStorage can throw (quota, private mode) — never break the page.
  }
}

/** Clear the stash (after a successful attach, or user clearing the field). */
export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
