import { NextResponse } from "next/server";
import { cancelSubscription } from "@/lib/payments/flutterwave";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Cancel Subscription route — user-initiated cancellation.
 *
 * Flow:
 *   1. Verify the caller is authenticated.
 *   2. Find their active subscription in our DB.
 *   3. Call Flutterwave's cancel API.
 *   4. Update our subscriptions table (status='cancelled', cancel_at_period_end=true).
 *
 * The user KEEPS Pro access until current_period_end — we don't revoke
 * immediately. This matches how Stripe/Flutterwave handle cancellations
 * (access continues until the period they paid for ends).
 *
 * Security: only the subscription owner can cancel. RLS on subscriptions
 * allows users to read their own rows, but writes are service-role only.
 */

export async function POST() {
  try {
    const cookieStore = await cookies();

    // 1. Verify the caller is authenticated.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized — no valid session." },
        { status: 401 }
      );
    }

    // 2. Find the user's active subscription.
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("id, external_subscription_id, status, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 404 }
      );
    }

    // 3. Cancel in Flutterwave (if we have the external ID).
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

    // 4. Update our subscriptions table via service role.
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

    return NextResponse.json({
      success: true,
      message: `Subscription cancelled. You'll keep Pro access until ${subscription.current_period_end ?? "your current period ends"}.`,
    });
  } catch (error) {
    console.error("[cancel-subscription] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}