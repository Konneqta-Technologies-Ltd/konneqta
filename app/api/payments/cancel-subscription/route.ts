import { NextResponse } from "next/server";
import { cancelSubscription } from "@/lib/payments/flutterwave";
import { getUserFromRequest } from "@/lib/supabase/request-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Cancel Subscription route — user-initiated cancellation.
 *
 * Flow:
 *   1. Verify the caller is authenticated (Bearer token OR SSR cookies —
 *      the shared dual-auth helper, so the mobile app can call this too).
 *   2. Find their active subscription in our DB.
 *   3. REFUSE store-billed subscriptions (origin/provider 'qonversion') —
 *      those must be cancelled in App Store / Play Store subscriptions;
 *      running them through here would cancel our row while the store
 *      keeps billing.
 *   4. Call Flutterwave's cancel API.
 *   5. Update our subscriptions table (status='cancelled', cancel_at_period_end=true).
 *
 * The user KEEPS Pro access until current_period_end — we don't revoke
 * immediately. This matches how Stripe/Flutterwave handle cancellations
 * (access continues until the period they paid for ends).
 *
 * Security: only the subscription owner can cancel. RLS on subscriptions
 * allows users to read their own rows, but writes are service-role only.
 */

export async function POST(req: Request) {
  try {
    // 1. Verify the caller is authenticated (Bearer for mobile / cookies for web).
    const { supabase, user } = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — no valid session." },
        { status: 401 }
      );
    }

    // 2. Find the user's active subscription (including origin/provider/plan
    //    so store-billed rows can be routed to the right place).
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select(
        "id, external_subscription_id, status, current_period_end, origin, provider, plan"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 404 }
      );
    }

    // 3. Store-billed subscriptions (Qonversion → App Store / Play Billing)
    //    are NEVER cancelled here. The caller must send the user to the
    //    store's subscription management instead — cancelling our row would
    //    desync it from the still-active store billing.
    const isStoreBilled =
      subscription.origin === "qonversion" || subscription.provider === "qonversion";
    if (isStoreBilled) {
      return NextResponse.json(
        {
          error:
            "This subscription is billed by the App Store / Google Play. Manage it from your store subscriptions.",
        },
        { status: 400 }
      );
    }

    // 4. Cancel in Flutterwave (if we have the external ID).
    if (subscription.external_subscription_id) {
      const flwSubId = Number(subscription.external_subscription_id);
      const result = await cancelSubscription(flwSubId);

      if (result.status !== "success") {
        console.error(
          "[cancel-subscription] Flutterwave cancel failed:",
          result.message
        );
        // Don't fail the whole request — we still want to update our DB.
        // The subscription might already be cancelled on Flutterwave's side.
      }
    }

    // 5. Update our subscriptions table via service role.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // Human-readable end date in the confirmation message (fallback to the
    // raw value when it can't be parsed).
    let periodEndLabel: string = subscription.current_period_end ?? "your current period ends";
    if (subscription.current_period_end) {
      try {
        periodEndLabel = new Date(
          subscription.current_period_end
        ).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch {
        // keep the raw value
      }
    }

    return NextResponse.json({
      success: true,
      message: `Subscription cancelled. You'll keep Pro access until ${periodEndLabel}.`,
    });
  } catch (error) {
    console.error("[cancel-subscription] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}