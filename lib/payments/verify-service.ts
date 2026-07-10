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
  const { data: payment, error: lookupError } = await admin
    .from("payments")
    .select("id, user_id, status, amount")
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
  const isSuccessful =
    verification.status === "success" &&
    txStatus === "successful" &&
    verifiedAmount === payment.amount;

  const newStatus = isSuccessful ? "successful" : txStatus === "cancelled" ? "cancelled" : "failed";

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status: newStatus,
      flw_transaction_id: transactionId,
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
    const { error: grantError } = await admin
      .from("profiles")
      .update({ plan: "pro" })
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
  }

  return {
    success: true,
    data: { status: newStatus },
  };
}