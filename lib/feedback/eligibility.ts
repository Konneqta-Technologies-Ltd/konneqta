/**
 * Feedback eligibility — server-side evaluation.
 *
 * Reads the user's `profiles` row (milestones + prompt/submission timestamps +
 * opted-out flag) and computes whether the feedback prompt should be shown.
 *
 * The DB is the source of truth (survives cookie clears / device switches).
 * localStorage in FeedbackTrigger only prevents re-showing within the same
 * browser session.
 */

import {
  ELIGIBILITY_THRESHOLD,
  computeScore,
} from "./score";

import type { SupabaseClient } from "@supabase/supabase-js";

// Re-prompt cadence (in days), depending on how the user dismissed the prompt.
export const REPROMPT_AFTER_SUBMIT_DAYS = 90;
export const REPROMPT_AFTER_LATER_DAYS = 21;
export const REPROMPT_AFTER_DISMISS_DAYS = 30;

export type EligibilityResult = {
  eligible: boolean;
  score: number;
  threshold: number;
  optedOut: boolean;
  /** Days since the prompt was last shown, or null if never. */
  daysSincePrompt: number | null;
  /** Days since feedback was last submitted, or null if never. */
  daysSinceSubmitted: number | null;
  reason?: string;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Evaluate feedback eligibility for a user.
 *
 * @param supabase - A Supabase client with access to `profiles` (anon or admin).
 * @param userId - The user's auth ID.
 */
export async function checkEligibility(
  supabase: SupabaseClient,
  userId: string
): Promise<EligibilityResult> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "feedback_milestones, feedback_last_prompt_at, feedback_last_submitted_at, feedback_opted_out, created_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return {
        eligible: false,
        score: 0,
        threshold: ELIGIBILITY_THRESHOLD,
        optedOut: false,
        daysSincePrompt: null,
        daysSinceSubmitted: null,
        reason: "profile_not_found",
      };
    }

    const score = computeScore(
      data.feedback_milestones ?? 0,
      data.created_at
    );
    const daysSincePrompt = daysSince(data.feedback_last_prompt_at);
    const daysSinceSubmitted = daysSince(data.feedback_last_submitted_at);

    // 1. Permanently opted out → never show.
    if (data.feedback_opted_out) {
      return {
        eligible: false,
        score,
        threshold: ELIGIBILITY_THRESHOLD,
        optedOut: true,
        daysSincePrompt,
        daysSinceSubmitted,
        reason: "opted_out",
      };
    }

    // 2. Not enough engagement yet.
    if (score < ELIGIBILITY_THRESHOLD) {
      return {
        eligible: false,
        score,
        threshold: ELIGIBILITY_THRESHOLD,
        optedOut: false,
        daysSincePrompt,
        daysSinceSubmitted,
        reason: "below_threshold",
      };
    }

    // 3. Submitted recently → wait REPROMPT_AFTER_SUBMIT_DAYS.
    if (
      daysSinceSubmitted !== null &&
      daysSinceSubmitted < REPROMPT_AFTER_SUBMIT_DAYS
    ) {
      return {
        eligible: false,
        score,
        threshold: ELIGIBILITY_THRESHOLD,
        optedOut: false,
        daysSincePrompt,
        daysSinceSubmitted,
        reason: "submitted_recently",
      };
    }

    // 4. Prompted recently → respect the cooldown (uses the shorter "later"
    //    window; "dismiss" is handled identically since both just set
    //    feedback_last_prompt_at).
    if (
      daysSincePrompt !== null &&
      daysSincePrompt < REPROMPT_AFTER_LATER_DAYS
    ) {
      return {
        eligible: false,
        score,
        threshold: ELIGIBILITY_THRESHOLD,
        optedOut: false,
        daysSincePrompt,
        daysSinceSubmitted,
        reason: "prompted_recently",
      };
    }

    // All checks passed.
    return {
      eligible: true,
      score,
      threshold: ELIGIBILITY_THRESHOLD,
      optedOut: false,
      daysSincePrompt,
      daysSinceSubmitted,
    };
  } catch {
    // Non-fatal — never block the page on eligibility.
    return {
      eligible: false,
      score: 0,
      threshold: ELIGIBILITY_THRESHOLD,
      optedOut: false,
      daysSincePrompt: null,
      daysSinceSubmitted: null,
      reason: "error",
    };
  }
}