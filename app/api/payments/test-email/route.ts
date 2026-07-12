import { NextRequest, NextResponse } from "next/server";

import {
  sendPaymentReceipt,
  sendAdminNotification,
  type PaymentEmailData,
} from "@/lib/emails/zeptomail";

/**
 * Email test route — lets you verify the ZeptoMail integration without making
 * a real payment.
 *
 * USAGE (with the dev server running):
 *
 *   curl -X POST http://localhost:3000/api/payments/test-email \
 *     -H "Content-Type: application/json" \
 *     -d '{"email": "your-email@gmail.com"}'
 *
 * Or in PowerShell:
 *   Invoke-RestMethod -Uri http://localhost:3000/api/payments/test-email `
 *     -Method Post -ContentType "application/json" `
 *     -Body '{"email":"your-email@gmail.com"}'
 *
 * Both the receipt email AND the admin notification will be sent to the
 * provided address so you can see both templates.
 *
 * SECURITY: This route is for development/testing only. In production you may
 * want to remove it or guard it behind an admin check.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email as string | undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid 'email' in the request body." },
        { status: 400 }
      );
    }

    // Sample data mimicking a real payment
    const testData: PaymentEmailData = {
      customerName: "Test User",
      customerEmail: email,
      amount: 285000, // ₦2,850.00 (in kobo)
      currency: "NGN",
      planName: "Konneqta Pro",
      txRef: "KONN_PREMIUM_UPGRADE_TEST_12345",
      transactionId: 999999999,
      paymentDate: new Date().toLocaleString("en-NG", {
        dateStyle: "full",
        timeStyle: "short",
      }),
    };

    // Send both emails in parallel
    const [receiptResult, adminResult] = await Promise.all([
      sendPaymentReceipt(testData),
      sendAdminNotification(testData),
    ]);

    return NextResponse.json({
      message: "Test emails sent! Check your inbox (and spam folder).",
      receipt: {
        sent: receiptResult.success,
        error: receiptResult.error || null,
      },
      adminNotification: {
        sent: adminResult.success,
        error: adminResult.error || null,
      },
    });
  } catch (error) {
    console.error("[test-email] Error:", error);
    return NextResponse.json(
      { error: "Failed to send test emails." },
      { status: 500 }
    );
  }
}