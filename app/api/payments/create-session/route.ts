import { NextRequest, NextResponse } from "next/server";

import { PaymentType } from "@/lib/payments/plans";
import { createPaymentSession } from "@/lib/payments/payment-service";

import { getUserFromRequest } from "@/lib/supabase/request-auth";

export async function POST(request: NextRequest) {
  try {
    // Auth: Bearer token (mobile) or SSR cookies (web). Unauthenticated
    // requests are rejected here — the user is NEVER taken from the body,
    // and the payment row + Pro grant are attributed server-side.
    const { supabase, user } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const paymentType = body.paymentType as PaymentType;
    const recurring = body.recurring === true;
    // Optional currency variant — defaults to NGN so existing mobile clients
    // (which never send it) behave exactly as before. Anything other than
    // "USD" resolves to NGN. The currency is NEVER taken from payment_type.
    const currency = body.currency === "USD" ? "USD" : "NGN";

    if (!paymentType) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment type is required.",
        },
        { status: 400 }
      );
    }

    // Pass the caller's own authenticated client through — the service
    // re-resolves the user from it (never trusting the request body), so
    // the pending payment row is attributed to the authenticated user.
    const result = await createPaymentSession(paymentType, recurring, supabase, currency);

    if (!result.success) {
      // Business guards (e.g. the Pro renewal window) keep their 400.
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Create Session Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while creating the payment session.",
      },
      { status: 500 }
    );
  }
}