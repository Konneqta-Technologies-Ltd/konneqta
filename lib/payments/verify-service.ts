import { getSubscription, verifyTransaction } from "./flutterwave";
import {
  sendAdminNotification,
  sendPaymentReceipt,
  sendReferralRewardEmail,
} from "@/lib/emails/zeptomail";
import { grantReferralReward } from "@/lib/referrals/service";

import { PAYMENT_PLANS } from "./plans";
import type { ServiceResponse } from "./types";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isKonneqtaReference } from "./references";

/**
 * Shared server-side payment verification + fulfillment logic.
 *
 * Used by both:
 *   - `/api/payments/verify` (client-initiated after the Flutterwave modal
 *     closes — fast path to show the user a success screen).
 *   - `/api/payments/webhook` (Flutterwave-server-initiated — the source of
 *     truth, runs regardless of whether the user closes the modal).
 *
 * Both call this function so the DB update + Pro grant happens in exactly one
 * place. Idempotent: if the payment is already marked successful, re-verifying
 * is a no-op.
 *
 * FLOW (for recurring billing):
 *   1. Verify transaction (Flutterwave API)
 *   2. Save provider_response (raw payload for debugging)
 *   3. Get subscription details from Flutterwave (if recurring)
 *   4. Create/update subscriptions row with Flutterwave's real dates
 *   5. Sync profiles (plan='pro', pro_expires_at = Flutterwave's next charge date)
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY to bypass RLS + the protect_entitlements
 * trigger.
 */

export async function verifyAndFulfilPayment(
  transactionId: number,
  txRef: string
): Promise<ServiceResponse<{ status: string }>> {
  // 1. Defensive checks — the tx_ref must look like one we generated.
  if (!isKonneqtaReference(txRef)) {
    return {
      success: false,
      message: "Invalid transaction reference format.",
    };
  }

  // 2. Call Flutterwave to verify the transaction (server-to-server).
  let verification;
  try {
    verification = await verifyTransaction(transactionId);
  } catch (err) {
    console.error("[verify-service] Flutterwave verify call failed:", err);
    return {
      success: false,
      message: "Could not verify the transaction with Flutterwave.",
    };
  }

  const txStatus = verification?.data?.status;
  const verifiedAmount = verification?.data?.amount;
  const verifiedTxRef = verification?.data?.tx_ref;

  // 3. Guard against a mismatched/forged tx_ref.
  if (verifiedTxRef && verifiedTxRef !== txRef) {
    console.error(
      "[verify-service] tx_ref mismatch:",
      verifiedTxRef,
      "!==",
      txRef
    );
    return {
      success: false,
      message: "Transaction reference does not match.",
    };
  }

  // 4. Connect to Supabase with the service role key (bypasses RLS + trigger).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 5. Look up the pending payment row we created at session creation.
  const { data: payment, error: lookupError } = await admin
    .from("payments")
    .select(
      "id, user_id, status, amount, currency, customer_email, customer_name, payment_type, subscription_id"
    )
    .eq("tx_ref", txRef)
    .single();

  if (lookupError || !payment) {
    console.error("[verify-service] Payment row not found for tx_ref:", txRef);
    return {
      success: false,
      message: "Payment record not found.",
    };
  }

  // 6. Idempotency — if already fulfilled, don't double-grant.
  if (payment.status === "successful") {
    return {
      success: true,
      data: { status: "successful" },
    };
  }

  // 7. Map Flutterwave's status to our internal status and update the row.
  //    We also validate the amount to prevent underpayment attacks.
  //    Store the ENTIRE provider response for debugging + set paid_at.
  const isSuccessful =
    verification.status === "success" &&
    txStatus === "successful" &&
    verifiedAmount === payment.amount;

  const newStatus = isSuccessful
    ? "successful"
    : txStatus === "cancelled"
      ? "cancelled"
      : "failed";

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status: newStatus,
      flutterwave_transaction_id: transactionId,
      // Store EVERYTHING Flutterwave sent us — priceless for debugging.
      provider_response: verification as unknown as Record<string, unknown>,
      // Record when the payment actually succeeded.
      paid_at: isSuccessful ? new Date().toISOString() : null,
    })
    .eq("tx_ref", txRef);

  if (updateError) {
    console.error("[verify-service] Failed to update payment row:", updateError);
    return {
      success: false,
      message: "Failed to update payment record.",
    };
  }

  // 8. Fulfillment — grant Pro + sync subscription if the payment is successful.
  if (isSuccessful) {
    await fulfillPayment(admin, payment, verification);

    // Product analytics (PostHog) — best-effort, never blocks fulfilment.
    // distinctId = Supabase user id, matching the client-side identify().
    try {
      const { captureEvent } = await import("@/lib/posthog");
      void captureEvent(payment.user_id, "payment_completed", {
        amount: payment.amount,
        currency: payment.currency,
        payment_type: payment.payment_type,
      }).catch(() => {});
    } catch {
      // PostHog not configured — ignore.
    }

    // 8b. Referral reward — if the payer signed up with someone's code and
    //     this is their FIRST successful payment, reward the referrer with
    //     Premium days (10 monthly / 90 yearly). Race-safe + once-only via
    //     the signed_up → rewarded compare-and-swap; failures never block
    //     the payment result. Renewals are no-ops (row already rewarded).
    try {
      const reward = await grantReferralReward({
        admin,
        referredUserId: payment.user_id,
        paymentId: payment.id,
        paymentType: payment.payment_type,
      });
      if (reward.granted) {
        console.log(
          `[verify-service] Referral reward: +${reward.days}d to referrer of`,
          payment.user_id
        );

        // Notify the referrer by email (best-effort — never affects the
        // payment or the reward). Only when the expiry was actually extended
        // (exempt referrers / lookup failures have nothing to announce).
        if (reward.expiryExtended && reward.recipientEmail) {
          try {
            const emailResult = await sendReferralRewardEmail({
              referrerName: reward.recipientName || "there",
              referrerEmail: reward.recipientEmail,
              daysAdded: reward.days ?? 0,
              referredUsername: reward.referredUsername ?? null,
              newProExpiresAt: reward.newProExpiresAt ?? new Date().toISOString(),
            });
            if (!emailResult.success) {
              console.warn(
                "[verify-service] Referral reward email may not have sent:",
                emailResult.error
              );
            }
          } catch (emailErr) {
            console.warn(
              "[verify-service] Referral reward email failed:",
              emailErr
            );
          }
        }
      }
    } catch (referralErr) {
      console.error("[verify-service] Referral reward failed:", referralErr);
    }

    // 9. 📧 Send email notifications (receipt to user + notification to admin).
    try {
      const planName =
        PAYMENT_PLANS[payment.payment_type as keyof typeof PAYMENT_PLANS]
          ?.name || "Konneqta Pro";
      const emailData = {
        customerName: payment.customer_name || "there",
        customerEmail: payment.customer_email || "",
        amount: payment.amount,
        currency: payment.currency,
        planName,
        txRef,
        transactionId,
        paymentDate: new Date().toLocaleString("en-NG", {
          dateStyle: "full",
          timeStyle: "short",
        }),
      };

      const [receiptResult, adminResult] = await Promise.allSettled([
        sendPaymentReceipt(emailData),
        sendAdminNotification(emailData),
      ]);

      if (receiptResult.status === "rejected" || !receiptResult.value.success) {
        console.warn(
          "[verify-service] Payment receipt email may not have sent:",
          receiptResult.status === "fulfilled"
            ? receiptResult.value.error
            : receiptResult.reason
        );
      }

      if (adminResult.status === "rejected" || !adminResult.value.success) {
        console.warn(
          "[verify-service] Admin notification email may not have sent:",
          adminResult.status === "fulfilled"
            ? adminResult.value.error
            : adminResult.reason
        );
      }
    } catch (emailErr) {
      console.error(
        "[verify-service] Unexpected error sending payment emails:",
        emailErr
      );
    }
  }

  return {
    success: true,
    data: { status: newStatus },
  };
}

// ── Subscription sync helper ──────────────────────────────────────────────
// Extracted so it's testable and readable. Handles both one-time payments
// (no subscription) and recurring payments (creates/updates subscription row).
async function fulfillPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  payment: {
    id: string;
    user_id: string;
    payment_type: string;
    subscription_id: string | null;
    customer_email: string;
  },
  verification: { data?: Record<string, unknown> }
) {
  // Flutterwave's verify response includes the full transaction data.
  // For recurring charges, the response includes subscription info.
  const txData = verification?.data ?? {};
  const customerId = (txData as { customer?: { id?: number } }).customer?.id;
  const flwSubscriptionId = (txData as { subscription_id?: number }).subscription_id;
  const flwPlanId = (txData as { payment_plan?: number }).payment_plan;

  // Determine if this is a recurring payment.
  const isRecurring = Boolean(flwSubscriptionId || flwPlanId);

  // The billing dates come DIRECTLY from Flutterwave — never calculated.
  let periodEnd: string | null = null;
  let periodStart: string | null = null;
  let subscriptionId: string | null = payment.subscription_id;

  if (isRecurring && flwSubscriptionId) {
    // Fetch the subscription from Flutterwave to get the REAL billing dates.
    try {
      const subDetails = await getSubscription(flwSubscriptionId);
      const subData = subDetails?.data;

      if (subData) {
        // next_charge_date is the REAL next billing date from Flutterwave.
        // This is what we use for pro_expires_at — NOT now() + 30 days.
        periodEnd = subData.next_charge_date ?? subData.next_payment_date ?? null;
        periodStart = subData.created_at ?? new Date().toISOString();

        // ── Create or update the subscription row ──
        const subRow = {
          user_id: payment.user_id,
          plan: payment.payment_type,
          status: "active",
          provider: "flutterwave",
          external_subscription_id: String(flwSubscriptionId),
          external_customer_id: customerId ? String(customerId) : null,
          external_plan_id: flwPlanId ? String(flwPlanId) : null,
          origin: "subscription",
          started_at: periodStart,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        };

        // Check if a subscription row already exists (renewal scenario).
        const { data: existingSub } = await admin
          .from("subscriptions")
          .select("id")
          .eq("user_id", payment.user_id)
          .eq("plan", payment.payment_type)
          .eq("status", "active")
          .maybeSingle();

        if (existingSub) {
          // Update existing subscription with new period dates.
          await admin
            .from("subscriptions")
            .update({
              current_period_start: periodStart,
              current_period_end: periodEnd,
              external_subscription_id: String(flwSubscriptionId),
            })
            .eq("id", existingSub.id);

          subscriptionId = existingSub.id;
        } else {
          // Create new subscription row.
          const { data: newSub, error: subError } = await admin
            .from("subscriptions")
            .insert(subRow)
            .select("id")
            .single();

          if (subError) {
            console.error(
              "[verify-service] Failed to create subscription row:",
              subError.message
            );
          } else if (newSub) {
            subscriptionId = newSub.id;
          }
        }
      }
    } catch (err) {
      console.error(
        "[verify-service] Failed to fetch subscription from Flutterwave:",
        err
      );
      // Non-fatal — fall through to one-time payment logic below.
    }
  }

  // ── Sync profiles (the fast read path for isPro) ──
  // pro_expires_at comes from Flutterwave's next_charge_date when available.
  // For one-time payments without a subscription, fall back to now() + 30 days.
  let proExpiresAt: string;

  if (periodEnd) {
    // Use Flutterwave's real billing date (recurring payments).
    proExpiresAt = periodEnd;
  } else {
    // One-time payment (no recurring plan) — grant based on the plan cycle.
    // Monthly = 30 days, Yearly = 365 days. Defaults to 30 for safety.
    const planCycle =
      PAYMENT_PLANS[payment.payment_type as keyof typeof PAYMENT_PLANS]?.cycle;
    const daysToAdd = planCycle === "yearly" ? 365 : 30;
    const fallbackExpiry = new Date();
    fallbackExpiry.setDate(fallbackExpiry.getDate() + daysToAdd);
    proExpiresAt = fallbackExpiry.toISOString();
  }

  const { error: grantError } = await admin
    .from("profiles")
    .update({ plan: "pro", pro_expires_at: proExpiresAt })
    .eq("id", payment.user_id);

  if (grantError) {
    console.error(
      "[verify-service] Failed to grant Pro to user",
      payment.user_id,
      grantError
    );
    // Don't fail the whole request — the payment row is already marked
    // successful, so a retry or manual fix can grant Pro later.
  }

  // ── Link payment to subscription (if we have one) ──
  if (subscriptionId && subscriptionId !== payment.subscription_id) {
    await admin
      .from("payments")
      .update({ subscription_id: subscriptionId })
      .eq("id", payment.id);
  }
}