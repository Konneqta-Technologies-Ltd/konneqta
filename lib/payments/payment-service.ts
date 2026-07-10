import { PAYMENT_PLANS, PaymentType } from "./plans";
import { PaymentSession, ServiceResponse } from "./types";

import { createClient } from "@/lib/supabase/server";
import { generateTransactionReference } from "./references";

export async function createPaymentSession(
    paymentType: PaymentType
): Promise<ServiceResponse<PaymentSession>> {
    const supabase = await createClient();

    // Get logged-in user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            success: false,
            message: "Unauthorized",
        };
    }

    // Fetch profile
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
        return {
            success: false,
            message: "User profile not found",
        }
    }

    // Prevent duplicate upgrades
    if (profile.plan === "pro") {
        return {
            success: false,
            message: "You already have an active Pro subscription.",
        };
    }

    // Look up the selected plan
    const plan = PAYMENT_PLANS[paymentType];

    if (!plan) {
        return {
            success: false,
            message: "Invalid payment type.",
        };
    }

    // Generate a unique transaction reference
    const txRef = generateTransactionReference(paymentType);

    // Save pending payment
    const { error: paymentError } = await supabase
        .from("payments")
        .insert({
            user_id: user.id,
            tx_ref: txRef,
            amount: plan.amount,
            currency: plan.currency,
            payment_type: paymentType,
            status: "pending",
            customer_email: profile.email,
            customer_name: profile.username,
        });

    if (paymentError) {
        return {
            success: false,
            message: paymentError.message,
        };
    }

    // Return the data the frontend needs
    return {
        success: true,
        data: {
            publicKey: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY!,
            txRef,
            amount: plan.amount,
            currency: plan.currency,
            customer: {
                email: profile.email,
                name: profile.username,
            },
            customizations: {
                title: "Konneqta",
                description: plan.description,
            },
        },
    }
}