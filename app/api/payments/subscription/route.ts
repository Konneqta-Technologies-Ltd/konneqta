import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/request-auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * GET /api/payments/subscription — the caller's current subscription state,
 * in the shape the mobile Settings "Pro Membership" section renders.
 *
 * Why a route instead of a direct client read: the `subscriptions` table was
 * created outside the repo (dashboard SQL), so its RLS policy for client
 * SELECTs can't be verified in-code. This route reads with the service-role
 * client scoped to the AUTHENTICATED caller's user id — the same trust level
 * as cancel-subscription — and returns a normalized payload:
 *
 *   data: {
 *     active: boolean,
 *     billing: 'flutterwave' | 'store' | 'none',
 *     planLabel: string | null,     // 'Pro' / 'Monthly' / 'Yearly'
 *     productId: string | null,     // store product id (Play deep link SKU)
 *     renewsAt: string | null,      // current_period_end (ISO)
 *     cancelAtPeriodEnd: boolean,
 *   }
 *
 * Dual-auth (mobile Bearer / web cookies) via getUserFromRequest.
 */

type SubscriptionRow = {
  plan: string | null;
  origin: string | null;
  provider: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

function isStoreBilled(row: SubscriptionRow): boolean {
  return row.origin === "qonversion" || row.provider === "qonversion";
}

function planLabelFor(row: SubscriptionRow): string | null {
  const plan = row.plan ?? "";
  if (isStoreBilled(row)) {
    // Qonversion rows carry the store product id, e.g. 'Konneqta-yearly'.
    if (/yearly/i.test(plan)) return "Yearly";
    if (/monthly/i.test(plan)) return "Monthly";
    return "Pro";
  }
  // Flutterwave rows carry a payment_type key from PAYMENT_PLANS (e.g.
  // 'monthly' / 'yearly' — the currency lives in payments.currency).
  return "Pro";
}

export async function GET(req: Request) {
  const { user } = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Service-role read scoped to the verified caller (RLS-agnostic — see
    // the header comment). The most recently started active row wins when a
    // user somehow holds two (e.g. switched billing provider mid-cycle).
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await admin
      .from("subscriptions")
      .select(
        "plan, origin, provider, current_period_end, cancel_at_period_end, started_at"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[subscription] read failed:", error.message);
      return NextResponse.json(
        { success: false, message: "Could not load your subscription." },
        { status: 500 }
      );
    }

    const row = (data?.[0] as SubscriptionRow | undefined) ?? undefined;
    if (!row) {
      return NextResponse.json({
        success: true,
        data: {
          active: false,
          billing: "none",
          planLabel: null,
          productId: null,
          renewsAt: null,
          cancelAtPeriodEnd: false,
        },
      });
    }

    const storeBilled = isStoreBilled(row);
    return NextResponse.json({
      success: true,
      data: {
        active: true,
        billing: storeBilled ? "store" : "flutterwave",
        planLabel: planLabelFor(row),
        // The raw plan value — the store product id for Qonversion rows
        // (Android Play deep link needs it as the SKU).
        productId: storeBilled ? row.plan : null,
        renewsAt: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end === true,
      },
    });
  } catch (err) {
    console.error("[subscription] unexpected error:", err);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}