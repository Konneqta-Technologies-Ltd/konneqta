import { NextRequest, NextResponse } from "next/server";

import { verifyAndFulfilPayment } from "@/lib/payments/verify-service";

/**
 * Payment verification route (client-initiated).
 *
 * After the Flutterwave checkout modal closes, the frontend calls this route
 * with the transaction ID and tx_ref. We verify server-side with Flutterwave
 * and update the payment + grant Pro.
 *
 * NOTE: The Flutterwave webhook is the source of truth. This route is a
 * "fast path" so the user sees a success screen without waiting for the
 * webhook. Both paths call the same shared verifyAndFulfilPayment(), which is
 * idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const transactionId = Number(body.transactionId);
    const txRef = String(body.txRef ?? "");

    if (!transactionId || !txRef) {
      return NextResponse.json(
        {
          success: false,
          message: "transactionId and txRef are required.",
        },
        { status: 400 }
      );
    }

    const result = await verifyAndFulfilPayment(transactionId, txRef);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[verify-route] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while verifying the payment.",
      },
      { status: 500 }
    );
  }
}