import { NextRequest, NextResponse } from "next/server";

import { verifyAndFulfilPayment } from "@/lib/payments/verify-service";

/**
 * Flutterwave webhook route (server-to-server).
 *
 * Flutterwave calls this endpoint after every payment attempt. This is the
 * SOURCE OF TRUTH for payment status — it runs even if the user closes the
 * browser tab, so it's more reliable than the client-side verify route.
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

    // 3. Only process completed charge events.
    if (event !== "charge.completed" || !transactionId || !txRef) {
      // Not an error — Flutterwave sends other event types too. Acknowledge.
      return NextResponse.json({ success: true, message: "Ignored event." });
    }

    // 4. Verify + fulfil the payment (idempotent shared logic).
    const result = await verifyAndFulfilPayment(transactionId, txRef);

    if (!result.success) {
      console.error("[webhook] Verification failed:", result.message);
      // Return 200 anyway — Flutterwave retries on non-2xx, and a failed
      // payment isn't a server error. The payment row is already updated.
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