/**
 * Referral system — server-side logic (service-role Supabase client required).
 *
 * Used by:
 *   - app/api/referrals/attach/route.ts  → attachReferral()
 *   - lib/payments/verify-service.ts     → grantReferralReward()
 *
 * RULES (product decisions, enforced here — the client is never trusted):
 *   1. A code can only be attached to an account BEFORE its first successful
 *      payment (no post-subscription "add my friend's code" retro-credit).
 *   2. One referrer per account, ever (unique referred_id).
 *   3. No self-referral.
 *   4. The reward fires exactly ONCE — on the referred user's FIRST
 *      successful payment — keyed by the payment plan cycle:
 *        monthly → +10 Premium days, yearly → +90 Premium days.
 *   5. Days stack on whatever the referrer already has:
 *      new_expiry = max(now, current_expiry) + reward_days.
 *
 * RACE SAFETY: the webhook and the client-verify route can both call
 * grantReferralReward for the same payment. The status='signed_up' →
 * 'rewarded' transition is an atomic compare-and-swap, so exactly one caller
 * wins; the loser's update matches 0 rows and is a silent no-op. Renewals
 * find the row already 'rewarded' and no-op too (reward is once, ever).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_PLANS } from "@/lib/payments/plans";
import { MIN_REFERRAL_CODE_LENGTH, normalizeReferralCode } from "./shared";

/** Premium days granted to the referrer, by the referred user's plan cycle. */
export const REFERRAL_REWARD_DAYS = {
  monthly: 10,
  yearly: 90,
} as const;

/** Resolve reward days for a payment_type ("monthly" | "yearly" | teams…). */
export function getReferralRewardDays(paymentType: string): number | null {
  const cycle = PAYMENT_PLANS[paymentType as keyof typeof PAYMENT_PLANS]?.cycle;
  if (cycle === "monthly") return REFERRAL_REWARD_DAYS.monthly;
  if (cycle === "yearly") return REFERRAL_REWARD_DAYS.yearly;
  return null; // Unknown/teams plans: no reward (yet).
}

export type AttachReferralResult = {
  ok: boolean;
  reason?:
    | "invalid_code" // Code missing/too short/not found.
    | "self_referral" // User typed their own code.
    | "already_referred" // Account already has a referrer.
    | "already_paid" // Account already has a successful payment.
    | "error"; // Unexpected DB error (logged).
};

/**
 * Attach a referral code to a freshly-created account.
 * Creates the `signed_up` row. Idempotent-safe: every precondition is
 * re-checked server-side, and the unique referred_id constraint is the
 * final backstop against double-attach races.
 */
export async function attachReferral(input: {
  admin: SupabaseClient;
  referredUserId: string;
  rawCode: string;
}): Promise<AttachReferralResult> {
  const { admin, referredUserId, rawCode } = input;
  const code = normalizeReferralCode(rawCode);
  if (code.length < MIN_REFERRAL_CODE_LENGTH) {
    return { ok: false, reason: "invalid_code" };
  }

  // 1. Resolve the referrer by code.
  const { data: referrer, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (lookupError) {
    console.error("[referrals] referrer lookup failed:", lookupError.message);
    return { ok: false, reason: "error" };
  }
  if (!referrer) return { ok: false, reason: "invalid_code" };
  if (referrer.id === referredUserId) {
    return { ok: false, reason: "self_referral" };
  }

  // 2. One referrer per account, ever.
  const { data: existing } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_referred" };

  // 3. The code must be attached BEFORE the first successful payment.
  //    (A `pending` checkout row is fine — nothing has been paid yet.)
  const { count: paidCount, error: paidError } = await admin
    .from("payments")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", referredUserId)
    .eq("status", "successful");
  if (paidError) {
    console.error("[referrals] payments lookup failed:", paidError.message);
    return { ok: false, reason: "error" };
  }
  if ((paidCount ?? 0) > 0) return { ok: false, reason: "already_paid" };

  // 4. Create the relationship (status starts at 'signed_up').
  const { error: insertError } = await admin.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: referredUserId,
    code_snapshot: code,
    status: "signed_up",
  });

  if (insertError) {
    // 23505 = unique violation on referred_id → concurrent double-attach.
    if (insertError.code === "23505") {
      return { ok: false, reason: "already_referred" };
    }
    console.error("[referrals] insert failed:", insertError.message);
    return { ok: false, reason: "error" };
  }

  return { ok: true };
}

export type GrantRewardResult = {
  granted: boolean;
  days?: number;
  expiryExtended?: boolean;
  /** Referrer's email (for the "you earned N days" notification). */
  recipientEmail?: string;
  /** Referrer's display name (first name is enough for the greeting). */
  recipientName?: string;
  /** The referred user's username (for the email body). */
  referredUsername?: string;
  /** Referrer's new Premium expiry (for the email body). */
  newProExpiresAt?: string;
};

/**
 * Reward the referrer when a referred user's FIRST successful payment is
 * verified. Called from verifyAndFulfilPayment() AFTER the payment row has
 * been marked successful. Idempotent + race-safe (see file header).
 */
export async function grantReferralReward(input: {
  admin: SupabaseClient;
  referredUserId: string;
  paymentId: string;
  paymentType: string;
}): Promise<GrantRewardResult> {
  const { admin, referredUserId, paymentId, paymentType } = input;

  const rewardDays = getReferralRewardDays(paymentType);
  if (!rewardDays) return { granted: false };

  // Only an unrewarded ('signed_up') referral can convert. The embedded join
  // also grabs the referred user's username for the reward email (service
  // role bypasses RLS).
  const { data: referral, error: findError } = await admin
    .from("referrals")
    .select(
      "id, referrer_id, status, referred:profiles!referrals_referred_id_fkey(username)"
    )
    .eq("referred_id", referredUserId)
    .eq("status", "signed_up")
    .maybeSingle();

  if (findError) {
    console.error("[referrals] reward lookup failed:", findError.message);
    return { granted: false };
  }
  if (!referral) return { granted: false }; // No referrer, or already rewarded.

  // Atomic compare-and-swap: only one caller (webhook vs verify race, or a
  // renewal) can flip signed_up → rewarded. `.maybeSingle()` returns null
  // when the WHERE no longer matches → someone else won → no-op.
  const nowIso = new Date().toISOString();
  const { data: updated, error: casError } = await admin
    .from("referrals")
    .update({
      status: "rewarded",
      reward_days: rewardDays,
      converted_payment_id: paymentId,
      converted_at: nowIso,
      rewarded_at: nowIso,
    })
    .eq("id", referral.id)
    .eq("status", "signed_up")
    .select("id")
    .maybeSingle();

  if (casError) {
    console.error("[referrals] reward CAS failed:", casError.message);
    return { granted: false };
  }
  if (!updated) return { granted: false };

  // Extend the referrer's Premium: max(now, current expiry) + reward days.
  // Uses the service role → bypasses the protect_entitlements trigger, same
  // as the Pro grant in verify-service. Email + name are fetched here so
  // verify-service can notify the referrer without a second lookup.
  const { data: referrer, error: referrerError } = await admin
    .from("profiles")
    .select("id, is_exempt, pro_expires_at, email, full_name")
    .eq("id", referral.referrer_id)
    .maybeSingle();

  if (referrerError || !referrer) {
    console.error(
      "[referrals] referrer profile lookup failed:",
      referrerError?.message ?? "not found"
    );
    // The referral row is already rewarded; just can't extend a ghost profile.
    return { granted: true, days: rewardDays, expiryExtended: false };
  }

  // Exempt users (e.g. staff) already have everything — nothing to extend.
  if (referrer.is_exempt) {
    return { granted: true, days: rewardDays, expiryExtended: false };
  }

  const now = new Date();
  const current = referrer.pro_expires_at
    ? new Date(referrer.pro_expires_at)
    : null;
  // Stack on remaining days (or start from today for a never-Pro referrer).
  const base = current && current.getTime() > now.getTime() ? current : now;
  base.setDate(base.getDate() + rewardDays);

  const { error: extendError } = await admin
    .from("profiles")
    .update({ plan: "pro", pro_expires_at: base.toISOString() })
    .eq("id", referrer.id);

  if (extendError) {
    console.error(
      "[referrals] failed to extend referrer Premium:",
      extendError.message
    );
    return { granted: true, days: rewardDays, expiryExtended: false };
  }

  // Referred username for the email (embedded join; PostgREST returns an
  // object with the explicit FK hint — array handled defensively).
  const referredJoin = referral.referred as unknown as
    | { username?: string }
    | { username?: string }[]
    | null
    | undefined;
  const referredUsername = Array.isArray(referredJoin)
    ? referredJoin[0]?.username
    : referredJoin?.username;

  return {
    granted: true,
    days: rewardDays,
    expiryExtended: true,
    recipientEmail: referrer.email ?? undefined,
    recipientName: referrer.full_name ?? undefined,
    referredUsername: referredUsername ?? undefined,
    newProExpiresAt: base.toISOString(),
  };
}

/**
 * Claw back a reward when the converting payment is refunded.
 *
 * NOT WIRED YET: nothing currently marks payments 'refunded' (the webhook
 * doesn't process refund events). When that lands, call this from the same
 * code path that sets status='refunded' — it flips the referral to
 * 'revoked' and subtracts the granted days (floored at now, so it can never
 * yank paid-for time, only the bonus).
 */
export async function revokeReferralReward(input: {
  admin: SupabaseClient;
  paymentId: string;
}): Promise<{ revoked: boolean }> {
  const { admin, paymentId } = input;

  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, reward_days, status")
    .eq("converted_payment_id", paymentId)
    .eq("status", "rewarded")
    .maybeSingle();

  if (!referral) return { revoked: false };

  const { error: casError } = await admin
    .from("referrals")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", referral.id)
    .eq("status", "rewarded");

  if (casError) {
    console.error("[referrals] revoke CAS failed:", casError.message);
    return { revoked: false };
  }

  // Subtract the granted days from the referrer (never below now).
  const { data: referrer } = await admin
    .from("profiles")
    .select("id, is_exempt, pro_expires_at")
    .eq("id", referral.referrer_id)
    .maybeSingle();

  if (!referrer || referrer.is_exempt || !referrer.pro_expires_at) {
    return { revoked: true };
  }

  const current = new Date(referrer.pro_expires_at);
  const now = new Date();
  const candidate = new Date(current);
  candidate.setDate(candidate.getDate() - referral.reward_days);
  const newExpiry = candidate.getTime() > now.getTime() ? candidate : now;

  await admin
    .from("profiles")
    .update({ pro_expires_at: newExpiry.toISOString() })
    .eq("id", referrer.id);

  return { revoked: true };
}
