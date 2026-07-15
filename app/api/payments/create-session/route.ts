import { NextRequest, NextResponse } from "next/server";

import { PaymentType } from "@/lib/payments/plans";
import { createPaymentSession } from "@/lib/payments/payment-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const paymentType = body.paymentType as PaymentType;
    const recurring = body.recurring === true;

    if (!paymentType) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment type is required.",
        },
        { status: 400 }
      );
    }

    const result = await createPaymentSession(paymentType, recurring);

    if (!result.success) {
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