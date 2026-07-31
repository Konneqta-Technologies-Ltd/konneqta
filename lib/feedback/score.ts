/**
 * Feedback milestone scoring — one-time-award bitmask system.
 *
 * Each milestone is awarded EXACTLY ONCE via a bitmask on
 * `profiles.feedback_milestones`. This avoids unbounded growth (a user who
 * shares 500 times still has the same score as someone who shared once).
 *
 * The bitmask is updated atomically via the `award_feedback_milestone` RPC
 * (see `supabase/feedback-eligibility-setup.sql`). Setting an already-set
 * bit is a no-op, so concurrent/duplicate calls are safe.
 *
 * SECURITY
 * --------
 * `awardMilestone` is callable from the BROWSER (anon key) because the RPC is
 * `security definer` and self-gates: it only updates the row whose id matches
 * the supplied p_user_id, and callers can't forge their auth.uid() session.
 */

import { createClient } from "@/lib/supabase/client";

// ─── Milestone definitions ─────────────────────────────────────────────────
// Bit values are powers of 2. Points are what each contributes to the score.
// DO NOT change bit values once in production (they're stored as ints).

export const MILESTONES = {
  CREATED_CARD: { bit: 1, points: 3, label: "Created card" },
  UPLOADED_AVATAR: { bit: 2, points: 2, label: "Uploaded avatar" },
  FIRST_SHARE: { bit: 4, points: 5, label: "First share" },
  FIRST_VCARD_DOWNLOAD: { bit: 8, points: 3, label: "First vCard download" },
  USED_ANALYTICS: { bit: 16, points: 2, label: "Used analytics" },
} as const;

export type MilestoneKey = keyof typeof MILESTONES;

/** Max achievable score from the bitmask alone (no time bonus). */
export const MAX_BITMASK_SCORE = Object.values(MILESTONES).reduce(
  (sum, m) => sum + m.points,
  0
); // = 15

/** Time-based bonus for accounts older than 7 days. Computed at check-time. */
const ACCOUNT_AGE_BONUS = 2;
const ACCOUNT_AGE_DAYS = 7;

/** Eligibility threshold. */
export const ELIGIBILITY_THRESHOLD = 12;

/**
 * Convert a bitmask int → total points (sum of awarded milestone points).
 */
export function bitmaskToScore(bitmask: number): number {
  let score = 0;
  for (const m of Object.values(MILESTONES)) {
    if (bitmask & m.bit) score += m.points;
  }
  return score;
}

/**
 * Check whether a specific milestone bit is set.
 */
export function hasMilestone(bitmask: number, key: MilestoneKey): boolean {
  return (bitmask & MILESTONES[key].bit) !== 0;
}

/**
 * Compute the full engagement score including the account-age bonus.
 * @param bitmask - The raw `feedback_milestones` int from profiles.
 * @param createdAt - ISO timestamp of account creation.
 */
export function computeScore(bitmask: number, createdAt: string | null): number {
  let score = bitmaskToScore(bitmask);
  if (createdAt) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays >= ACCOUNT_AGE_DAYS) score += ACCOUNT_AGE_BONUS;
  }
  return score;
}

/**
 * Award a milestone to the current user via the atomic RPC.
 *
 * This is safe to call from the browser (the RPC is security definer + gates
 * on the caller's session). Fire-and-forget: errors are logged and swallowed
 * so a scoring hiccup never breaks the user-facing flow.
 *
 * @param userId - The user's auth ID (passed for clarity; the RPC uses the
 *                 session, not this param, for authorization).
 * @param key - Which milestone to award.
 */
export async function awardMilestone(
  userId: string,
  key: MilestoneKey
): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("award_feedback_milestone", {
      p_user_id: userId,
      p_milestone: MILESTONES[key].bit,
    });
    if (error) {
      // Expected if the migration hasn't been run yet — safe to ignore.
      console.warn("[feedback] awardMilestone RPC failed:", error.message);
    }
  } catch (err) {
    console.warn("[feedback] awardMilestone error (non-fatal):", err);
  }
}