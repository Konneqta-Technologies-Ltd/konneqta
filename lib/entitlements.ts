/**
 * Entitlements — the single source of truth for "can this user do X?".
 *
 * SECURITY MODEL
 * --------------
 * - The `plan` and `is_exempt` columns are locked at the DB layer by a
 *   trigger (see supabase/entitlements-setup.sql). Users cannot self-grant.
 * - This file is the READ side only: it inspects a profile row and returns
 *   boolean feature flags. It never authorises anything on its own — the
 *   DB trigger + RLS are the real gate. This keeps logic in one place so
 *   every component (server or client) asks the same question the same way.
 *
 * GRACEFUL DEGRADATION
 * --------------------
 * If `plan`/`is_exempt` are absent (e.g. migration not yet run, or a stale
 * cached row), everything resolves to FREE-tier behaviour — the safe default.
 */

/**
 * Hardcoded exempt usernames (builder / staff override).
 *
 * SERVER-ONLY conceptually, but this array is safe to ship to the client
 * because it only grants feature access that the DB trigger already blocks
 * for non-exempt users. A malicious user editing their own username to
 * "vicwin13" will collide with the unique constraint, and the is_exempt flag
 * on the real vicwin13's row is what the trigger protects.
 *
 * Add usernames here to grant all Pro features + no restrictions, free.
 */
export const EXEMPT_USERNAMES = ["vicwin13"] as const;

/** The plan tiers. */
export type Plan = "free" | "pro";

/** A single plan's feature limits. */
export type PlanLimits = {
  maxCards: number;
  canUploadLogo: boolean;
  canUseThemes: boolean;
  canUseBanners: boolean;
  canUseSignature: boolean;
};

/** Plan-level limits. Used by the multi-card feature (Phase 4). */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxCards: 1,
    canUploadLogo: false,
    canUseThemes: false,
    canUseBanners: false,
    canUseSignature: false,
  },
  pro: {
    maxCards: 3,
    canUploadLogo: true,
    canUseThemes: true,
    canUseBanners: true,
    canUseSignature: true,
  },
};

/**
 * A minimal profile slice this helper needs. Accepting a narrow shape (not
 * the whole Profile type) lets us call it from server components, client
 * components, route handlers, and tests without coupling.
 */
export type EntitlementProfile = {
  username?: string | null;
  plan?: Plan | string | null;
  is_exempt?: boolean | null;
  /** ISO timestamp when Pro access expires. Null = never had Pro / exempt. */
  pro_expires_at?: string | null;
};

/**
 * True if this user is on the exempt list (hardcoded OR database flag).
 * Exempt users bypass every Pro restriction.
 */
export function isExempt(profile: EntitlementProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_exempt === true) return true;
  if (profile.username && (EXEMPT_USERNAMES as readonly string[]).includes(profile.username)) {
    return true;
  }
  return false;
}

/**
 * True if the user has Pro access (paying subscriber with unexpired
 * subscription OR exempt).
 *
 * EXPIRY (lazy evaluation):
 * We check `pro_expires_at` here rather than relying solely on a cron job.
 * This guarantees a user drops to free the INSTANT their subscription lapses,
 * regardless of whether the cleanup job has run. The column is
 * service-role-writable only (DB trigger), so clients can't forge it.
 */
export function isPro(profile: EntitlementProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isExempt(profile)) return true;
  if (profile.plan !== "pro") return false;

  // Lazy expiry check — if the timestamp passed, they're free now.
  if (profile.pro_expires_at) {
    const expiry = new Date(profile.pro_expires_at);
    if (expiry.getTime() < Date.now()) {
      return false;
    }
  }

  return true;
}

/**
 * Days remaining until the user's Pro subscription expires.
 * Returns Infinity for exempt users, and null for users who have never
 * had Pro (no expiry timestamp).
 *
 * Returns a negative number if the subscription has already expired —
 * useful for UI messaging like "expired 3 days ago".
 */
export function getDaysUntilExpiry(
  profile: EntitlementProfile | null | undefined
): number | null {
  if (!profile) return null;
  if (isExempt(profile)) return Infinity;
  if (!profile.pro_expires_at) return null;

  const msRemaining =
    new Date(profile.pro_expires_at).getTime() - Date.now();
  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

/**
 * Resolve the effective plan for a user. Exempt users report as "pro".
 */
export function getEffectivePlan(
  profile: EntitlementProfile | null | undefined
): Plan {
  return isPro(profile) ? "pro" : "free";
}

/**
 * Feature-flag helpers. Each delegates to PLAN_LIMITS so there's one table
 * to edit when limits change. Exempt users always get the pro set.
 *
 * Usage:
 *   const { canUploadLogo } = getFeatureFlags(profile);
 *   if (canUploadLogo) { ... render the logo uploader ... }
 */
export function getFeatureFlags(
  profile: EntitlementProfile | null | undefined
): PlanLimits {
  const plan = getEffectivePlan(profile);
  return PLAN_LIMITS[plan];
}

/** Convenience: can this user upload the company/brand logo? */
export function canUploadLogo(profile: EntitlementProfile | null | undefined): boolean {
  return getFeatureFlags(profile).canUploadLogo;
}

/** Convenience: can this user pick a custom theme? */
export function canUseThemes(profile: EntitlementProfile | null | undefined): boolean {
  return getFeatureFlags(profile).canUseThemes;
}

/** Convenience: can this user set a banner? */
export function canUseBanners(profile: EntitlementProfile | null | undefined): boolean {
  return getFeatureFlags(profile).canUseBanners;
}

/** Convenience: can this user build an email signature? */
export function canUseSignature(profile: EntitlementProfile | null | undefined): boolean {
  return getFeatureFlags(profile).canUseSignature;
}

/**
 * How many cards can this user create?
 * Exempt users (e.g. vicwin13) are unlimited → Infinity.
 * Pro = 3, Free = 1.
 */
export function getMaxCards(profile: EntitlementProfile | null | undefined): number {
  if (isExempt(profile)) return Infinity;
  return getFeatureFlags(profile).maxCards;
}
