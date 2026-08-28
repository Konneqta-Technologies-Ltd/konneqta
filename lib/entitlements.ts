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
  /** Monthly share cap (owner sharing their own card). Infinity = unlimited. */
  maxShares: number;
  canUploadLogo: boolean;
  canUseThemes: boolean;
  canUseBanners: boolean;
  canUseSignature: boolean;
  /**
   * How many social links a user may add to a card.
   * Free = 3, Pro = 7.
   *
   * This is a COUNT-based limit (how many links), not a platform-based one
   * (which specific platforms) — users can mix-and-match any platforms from
   * the full list up to their tier's cap. A future "Pro+" tier can raise this
   * number to unlock more slots without touching the platform list.
   */
  maxSocialLinks: number;
  /**
   * How many showcase items (products/services) a user may add to a card.
   * Free = 2, Pro = 10.
   *
   * COUNT-based like maxSocialLinks. Enforced for real by the
   * `_kq_enforce_showcase_item_limit` DB trigger
   * (supabase/showcase-setup.sql) — this table is the read side the UI uses
   * to swap the add affordances for a padlocked upgrade slot at the cap.
   */
  maxShowcaseItems: number;
  /**
   * How many Konneqts (connections) are VISIBLE on the Konneqts page.
   * Free = 10, Pro = unlimited.
   *
   * IMPORTANT: this is DISPLAY-ONLY. Every connection is always stored — a
   * user is never blocked from making a new connection because they're on the
   * free tier. The limit only controls how many rows the Konneqts page
   * returns; the rest are counted for the "🔒 N more · Upgrade" footer.
   */
  maxVisibleKonneqts: number;
};

/** Plan-level limits. Used by the multi-card feature (Phase 4). */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxCards: 1,
    // Free users may share their own card up to 25 times per calendar month.
    maxShares: 25,
    canUploadLogo: false,
    canUseThemes: false,
    canUseBanners: false,
    canUseSignature: false,
    // Free users can add up to 3 social links (any mix of platforms).
    maxSocialLinks: 3,
    // Free users can showcase up to 2 items. Upgrade to Pro for 10.
    maxShowcaseItems: 2,
    // Free users see their 10 most recent Konneqts (the rest are stored +
    // surfaced via an upgrade prompt). Connections are never blocked.
    maxVisibleKonneqts: 10,
  },
  pro: {
    maxCards: 3,
    // Pro users have unlimited shares.
    maxShares: Infinity,
    canUploadLogo: true,
    canUseThemes: true,
    canUseBanners: true,
    canUseSignature: true,
    // Pro users can add up to 7 social links (any mix of platforms).
    maxSocialLinks: 7,
    // Pro users can showcase up to 10 items.
    maxShowcaseItems: 10,
    // Pro users see all their Konneqts.
    maxVisibleKonneqts: Infinity,
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

/**
 * How many times can this user share their card this calendar month?
 * Exempt users are unlimited → Infinity. Pro = Infinity. Free = 25.
 *
 * This is the READ side only — the real enforcement happens server-side in
 * app/api/share/route.ts (clients can't be trusted to count honestly).
 */
export function getMaxShares(profile: EntitlementProfile | null | undefined): number {
  if (isExempt(profile)) return Infinity;
  return getFeatureFlags(profile).maxShares;
}

/**
 * How many social links can this user add to a single card?
 * Exempt users are unlimited → Infinity. Pro = 7. Free = 3.
 *
 * This is the READ side only — the real enforcement happens server-side in
 * the onboarding / save-card routes (clients can't be trusted to count
 * honestly). The UI uses this to disable the "Add link" button and show an
 * upgrade prompt when the limit is reached.
 */
export function getMaxSocialLinks(profile: EntitlementProfile | null | undefined): number {
  if (isExempt(profile)) return Infinity;
  return getFeatureFlags(profile).maxSocialLinks;
}

/**
 * How many showcase items can a user add to a single card?
 * Exempt users are unlimited → Infinity. Pro = 10. Free = 2.
 *
 * This is the READ side only — the real enforcement happens at the DB
 * (supabase/showcase-setup.sql, trigger `_kq_enforce_showcase_item_limit`).
 * The UI uses this to swap the "Add" affordances for a padlocked upgrade
 * slot when the cap is reached.
 */
export function getMaxShowcaseItems(profile: EntitlementProfile | null | undefined): number {
  if (isExempt(profile)) return Infinity;
  return getFeatureFlags(profile).maxShowcaseItems;
}

/**
 * How many Konneqts are visible on the Konneqts page?
 * Exempt users are unlimited → Infinity. Pro = Infinity. Free = 10.
 *
 * DISPLAY-ONLY: every connection is always stored regardless of this limit.
 * The Konneqts page uses this to cap the rows it returns and to compute the
 * "🔒 N more · Upgrade" count. A user is never blocked from connecting.
 */
export function getMaxVisibleKonneqts(profile: EntitlementProfile | null | undefined): number {
  if (isExempt(profile)) return Infinity;
  return getFeatureFlags(profile).maxVisibleKonneqts;
}
