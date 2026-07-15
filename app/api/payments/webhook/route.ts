import { NextRequest, NextResponse } from "next/server";

import { verifyAndFulfilPayment } from "@/lib/payments/verify-service";

/**
 * Flutterwave webhook route (server-to-server).
 *
 * Flutterwave calls this endpoint after every payment attempt AND every
 * subscription lifecycle event. This is the SOURCE OF TRUTH for payment +
 * subscription status — it runs even if the user closes the browser tab.
 *
 * HANDLED EVENTS
 * --------------
 *   charge.completed        — initial payment, renewal charge, or one-time
 *   subscription.cancelled  — user (or admin) cancelled the subscription
 *   charge.failed           — renewal charge failed (card declined, etc.)
 *
 * ARCHITECTURE
 * ------------
 * For `charge.completed`, we DON'T assume different event names for initial
 * vs renewal. Instead, we inspect the payload: if it contains subscription
 * info, it's a recurring charge; otherwise it's one-time. Both paths go
 * through `verifyAndFulfilPayment()`, which always syncs from the provider.
 *
 * SECURITY
 * --------
 * We verify the `verif-hash` header matches our secret webhook hash from the
 * Flutterwave dashboard. Without this, anyone could POST a fake "successful"
 * payload and get free Pro.
 *
 * SETUP
 * -----
 * 1. In the Flutterwave dashboard: Settings → Webhooks.
 * 2. Set the webhook URL to: https://yourdomain.com/api/payments/webhook
 * 3. Copy the "Secret hash" into your .env.local as FLW_WEBHOOK_HASH.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify the webhook signature.
    const incomingHash = request.headers.get("verif-hash");
    const secretHash = process.env.FLW_WEBHOOK_HASH;

    if (!secretHash) {
      console.error(
        "[webhook] FLW_WEBHOOK_HASH is not set — cannot verify webhook."
      );
      return NextResponse.json(
        { error: "Webhook secret not configured." },
        { status: 500 }
      );
    }

    // If the hash doesn't match, reject the request.
    if (!incomingHash || incomingHash !== secretHash) {
      console.warn("[webhook] Invalid webhook hash — rejecting.");
      return NextResponse.json({ error: "Invalid hash." }, { status: 401 });
    }

    // 2. Parse the webhook payload.
    const body = await request.json();

    // Flutterwave sends: { event: "charge.completed", data: { id, tx_ref, ... } }
    const event = body.event as string | undefined;
    const transactionId = body?.data?.id as number | undefined;
    const txRef = body?.data?.tx_ref as string | undefined;

    // 3. Route based on event type.
    switch (event) {
      // ── charge.completed ───────────────────────────────────────────────
      // Handles BOTH initial payments and recurring renewal charges.
      // The same event type is emitted for both — we inspect the payload to
      // determine which path to take inside verifyAndFulfilPayment().
      case "charge.completed": {
        if (!transactionId || !txRef) {
          return NextResponse.json({
            success: true,
            message: "Ignored: missing transaction data.",
          });
        }

        // verifyAndFulfilPayment() internally checks for subscription info
        // and syncs from Flutterwave. It handles both one-time + recurring.
        const result = await verifyAndFulfilPayment(transactionId, txRef);

        if (!result.success) {
          console.error("[webhook] Verification failed:", result.message);
          // Return 200 anyway — Flutterwave retries on non-2xx, and a failed
          // payment isn't a server error. The payment row is already updated.
        }
        break;
      }

      // ── subscription.cancelled ────────────────────────────────────────
      // User cancelled their subscription. Mark it locally + sync from provider.
      case "subscription.cancelled": {
        const flwSubscriptionId = body?.data?.id as number | undefined;
        const txRefFromPayload = body?.data?.tx_ref as string | undefined;

        if (flwSubscriptionId) {
          // Update our subscriptions table via service role.
          const { createClient: createAdminClient } = await import(
            "@supabase/supabase-js"
          );
          const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
              auth: { autoRefreshToken: false, persistSession: false },
            }
          );

          // Mark subscription as cancelled. The user keeps access until
          // current_period_end (already stored). We set cancel_at_period_end
          // so isPro() continues to work until expiry.
          await admin
            .from("subscriptions")
            .update({
              status: "cancelled",
              cancel_at_period_end: true,
              cancelled_at: new Date().toISOString(),
            })
            .eq("external_subscription_id", String(flwSubscriptionId));

          console.log(
            "[webhook] Subscription cancelled:",
            flwSubscriptionId,
            txRefFromPayload ?? "(no tx_ref)"
          );
        }
        break;
      }

      // ── charge.failed ─────────────────────────────────────────────────
      // A renewal charge failed (e.g. card declined). Mark subscription as
      // past_due. Flutterwave will retry — if all retries fail, the user's
      // access expires at current_period_end.
      case "charge.failed": {
        const txRefFromPayload = body?.data?.tx_ref as string | undefined;

        if (txRefFromPayload) {
          const { createClient: createAdminClient } = await import(
            "@supabase/supabase-js"
          );
          const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
              auth: { autoRefreshToken: false, persistSession: false },
            }
          );

          // Find the subscription linked to this payment and mark it past_due.
          const { data: paymentRow } = await admin
            .from("payments")
            .select("subscription_id")
            .eq("tx_ref", txRefFromPayload)
            .maybeSingle();

          if (paymentRow?.subscription_id) {
            await admin
              .from("subscriptions")
              .update({ status: "past_due" })
              .eq("id", paymentRow.subscription_id);
          }

          // Update the payment row status.
          await admin
            .from("payments")
            .update({ status: "failed" })
            .eq("tx_ref", txRefFromPayload);

          console.log(
            "[webhook] Charge failed for:",
            txRefFromPayload
          );
        }
        break;
      }

      default:
        // Other event types (transfer.completed, etc.) — acknowledge + ignore.
        return NextResponse.json({
          success: true,
          message: `Ignored event: ${event}`,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}