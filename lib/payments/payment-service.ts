import { Currency, PAYMENT_PLANS, PaymentType } from "./plans";
import { PaymentSession, ServiceResponse } from "./types";
import { getDaysUntilExpiry, isPro } from "@/lib/entitlements";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTransactionReference } from "./references";

export async function createPaymentSession(
    paymentType: PaymentType,
    recurring: boolean = false,
    // Optional pre-authenticated client — lets the MOBILE app create a
    // session with its Supabase access token (route resolves it via
    // getUserFromRequest: Bearer or cookies). When omitted, the original
    // cookie-scoped client is created here, so the web behaviour is
    // byte-for-byte unchanged. RLS scopes the profile select + payment
    // insert to the authenticated owner either way.
    supabase?: SupabaseClient,
    // Currency variant to price the session in. Optional, defaults to NGN —
    // existing mobile clients (which never send it) behave byte-for-byte the
    // same as before. USD forces card-only auto-renew (see below).
    currency: Currency = "NGN",
): Promise<ServiceResponse<PaymentSession>> {
    const db = supabase ?? (await createClient());

    // Get logged-in user
    const {
        data: { user },
    } = await db.auth.getUser();

    if (!user) {
        return {
            success: false,
            message: "Unauthorized",
        };
    }

    // Fetch profile
    const { data: profile, error } = await db
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

    // Resolve the currency variant. `payment_type` identifies the product;
    // `currency` picks the price/Flutterwave-plan. The currency itself is
    // stored in the payments.currency column — never baked into payment_type.
    const variant = plan.variants[currency];

    // USD is auto-renew (Payment Plan) ONLY — even if a caller asks for a
    // one-time USD charge, we force the plan so every dollar subscriber is a
    // managed auto-renewal (the UI matches: USD hides the one-time option).
    const isUsd = variant.currency === "USD";
    const wantsPlan = recurring || isUsd;
    const paymentPlan =
        wantsPlan && variant.environmentPlanId
            ? Number(variant.environmentPlanId)
            : undefined;

    // Guard: a missing/unset USD Payment Plan ID would make Flutterwave run
    // this as a plain ONE-TIME card charge (no auto-renewal) while the user
    // believes they subscribed. Fail loudly instead of silently degrading.
    if (isUsd && !paymentPlan) {
        return {
            success: false,
            message:
                "USD payments are not configured yet. Please pay in Naira or contact support.",
        };
    }

    // Recurring (card only) vs One-Time (all methods).
    // Flutterwave Payment Plans require a card token, so recurring billing
    // restricts to card. One-time allows bank transfer, USSD, etc.
    // USD is card-only regardless — bank transfer/USSD are Nigerian rails.
    const paymentOptions = wantsPlan ? "card" : "card,banktransfer,ussd";

    // Generate a unique transaction reference (currency embedded for USD)
    const txRef = generateTransactionReference(paymentType, currency);

    // Save pending payment
    const { error: paymentError } = await db
        .from("payments")
        .insert({
            user_id: user.id,
            tx_ref: txRef,
            amount: variant.amount,
            currency: variant.currency,
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
            amount: variant.amount,
            currency: variant.currency,
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