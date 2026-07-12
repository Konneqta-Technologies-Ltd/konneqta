import { sendAdminNotification, sendPaymentReceipt } from "@/lib/emails/zeptomail";

import { PAYMENT_PLANS } from "./plans";
import type { ServiceResponse } from "./types";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isKonneqtaReference } from "./references";
import { verifyTransaction } from "./flutterwave";

/**
 * Shared server-side payment verification + fulfilment logic.
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
 * Uses the SUPABASE_SERVICE_ROLE_KEY to:
 *   - UPDATE the payments row (RLS blocks user JWTs from writing).
 *   - UPDATE profiles.plan = 'pro' (the protect_entitlements trigger blocks
 *     user JWTs from changing plan; only service_role can).
 */

/**
 * Result of verifying a Flutterwave transaction.
 * Returns the new payment status so callers can respond appropriately.
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

  // Flutterwave returns { status: "success", data: { status: "successful", ... } }
  // The outer `status` is the API call status; the inner `data.status` is the
  // transaction status.
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
  //    We select the extra fields needed for the email receipt, plus the
  //    owner's current pro_expires_at (so a renewal extends rather than resets).
  const { data: payment, error: lookupError } = await admin
    .from("payments")
    .select(
      "id, user_id, status, amount, currency, customer_email, customer_name, payment_type"
    )
    .eq("tx_ref", txRef)
    .single();

  // Fetch the user's current Pro expiry (if any) so renewals stack correctly.
  let currentExpiry: string | null = null;
  if (payment?.user_id) {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("pro_expires_at")
      .eq("id", payment.user_id)
      .maybeSingle();
    currentExpiry = profileRow?.pro_expires_at ?? null;
  }

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
  const isSuccessful =
    verification.status === "success" &&
    txStatus === "successful" &&
    verifiedAmount === payment.amount;

  const newStatus = isSuccessful ? "successful" : txStatus === "cancelled" ? "cancelled" : "failed";

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status: newStatus,
      flutterwave_transaction_id: transactionId,
    })
    .eq("tx_ref", txRef);

  if (updateError) {
    console.error("[verify-service] Failed to update payment row:", updateError);
    return {
      success: false,
      message: "Failed to update payment record.",
    };
  }

  // 8. Fulfilment — grant Pro if the payment is successful.
  if (isSuccessful) {
    // Calculate the new Pro expiry (30 days). If the user still has an active
    // subscription, extend from the current expiry so they don't lose remaining
    // days. Otherwise, start the clock from now.
    const SUBSCRIPTION_DAYS = 30;
    const now = new Date();
    const baseDate =
      currentExpiry && new Date(currentExpiry).getTime() > now.getTime()
        ? new Date(currentExpiry)
        : now;
    const newExpiry = new Date(
      baseDate.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
    );

    const { error: grantError } = await admin
      .from("profiles")
      .update({ plan: "pro", pro_expires_at: newExpiry.toISOString() })
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

    // 9. 📧 Send email notifications (receipt to user + notification to admin).
    //    Wrapped in try/catch — email failures must NEVER break the payment.
    //    The user already has Pro; the email is a nice-to-have.
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

      // Send both emails in parallel (don't block one on the other).
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