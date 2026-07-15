import { PAYMENT_PLANS, PaymentType } from "./plans";
import { PaymentSession, ServiceResponse } from "./types";
import { getDaysUntilExpiry, isPro } from "@/lib/entitlements";

import { createClient } from "@/lib/supabase/server";
import { generateTransactionReference } from "./references";

export async function createPaymentSession(
    paymentType: PaymentType,
    recurring: boolean = false
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

    // Prevent duplicate upgrades — but allow renewals.
    // A user can pay if:
    //   - They are NOT currently Pro (free or expired), OR
    //   - They ARE Pro but their subscription expires within 7 days (early renewal).
    // This block stops someone with 20 days left from paying again unnecessarily,
    // while letting expired users and users near expiry renew.
    if (isPro(profile)) {
        const daysLeft = getDaysUntilExpiry(profile);
        if (daysLeft !== null && daysLeft > 7) {
            return {
                success: false,
                message: `You already have an active Pro subscription with ${daysLeft} days left. You can renew when you're within 7 days of expiry.`,
            };
        }
    }

    // Look up the selected plan
    const plan = PAYMENT_PLANS[paymentType];

    if (!plan) {
        return {
            success: false,
            message: "Invalid payment type.",
        };
    }

    // Resolve the Flutterwave Payment Plan ID for recurring billing.
    // Read from the plan object's `environmentPlanId` (set in plans.ts).
    // ONLY applies when the user chose "Auto-Renew" (recurring = true).
    // One-time payments (transfer/USSD) skip the payment plan entirely.
    const flwPlanIdEnv =
        "environmentPlanId" in plan ? plan.environmentPlanId : undefined;
    const paymentPlan =
        recurring && flwPlanIdEnv ? Number(flwPlanIdEnv) : undefined;

    // Recurring (card only) vs One-Time (all methods).
    // Flutterwave Payment Plans require a card token, so recurring billing
    // restricts to card. One-time allows bank transfer, USSD, etc.
    const paymentOptions = recurring ? "card" : "card,banktransfer,ussd";

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
            paymentOptions,
            paymentPlan,
        },
    }
}