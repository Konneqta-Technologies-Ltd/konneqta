/**
 * POST /api/promos/redeem — redeem a promo code for free Premium days.
 *
 * Body: { code: string }
 *
 * The caller is authenticated via cookie, then the actual work happens in the
 * `redeem_promo` Postgres RPC with the SERVICE ROLE key — one atomic
 * transaction that validates every rule (active, window, once-per-account,
 * max_uses) and grants + STACKS the days:
 *   new expiry = greatest(now(), current expiry) + reward_days.
 *
 * This route only maps the RPC's machine reasons to friendly messages.
 * Nothing here is ever trusted from the browser.
 */

import { normalizePromoCode } from "@/lib/promos/shared";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** RPC result shape (see redeem_promo in supabase/promo-codes-setup.sql). */
type RedeemPromoResult = {
  ok?: boolean;
  reason?: string;
  days_granted?: number;
  new_expiry?: string;
};

const REASON_MESSAGES: Record<string, { error: string; status: number }> = {
  invalid_code: {
    error: "That doesn't look like a valid code. Check the spelling.",
    status: 400,
  },
  not_found: {
    error: "Code not found. Check the spelling and try again.",
    status: 404,
  },
  inactive: {
    error: "This code is no longer active.",
    status: 410,
  },
  not_started: {
    error: "This code isn't available yet.",
    status: 400,
  },
  expired: {
    error: "This code has expired.",
    status: 410,
  },
  exempt: {
    error: "You already have unlimited Premium — no code needed!",
    status: 400,
  },
  already_redeemed: {
    error: "You've already used this code.",
    status: 409,
  },
  fully_redeemed: {
    error: "This code has been fully redeemed.",
    status: 410,
  },
  user_not_found: {
    error: "Account not found.",
    status: 404,
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? normalizePromoCode(body.code) : "";

    if (!code) {
      return NextResponse.json(
        { error: "Enter a promo code.", reason: "invalid_code" },
        { status: 400 }
      );
    }

    // --- Auth: verify the caller's session via cookie ----------------------
    const cookieStore = await cookies();
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
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // --- Redeem via the atomic DB RPC (service role) -----------------------
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: result, error: rpcError } = await admin.rpc("redeem_promo", {
      p_code: code,
      p_user_id: user.id,
    });

    if (rpcError) {
      // P0001-style errors shouldn't happen (the RPC returns reasons, not
      // raises), but never leak internals.
      console.error("[api/promos/redeem] RPC error:", rpcError.message);
      return NextResponse.json(
        { error: "Something went wrong redeeming the code. Please try again." },
        { status: 500 }
      );
    }

    const outcome = (Array.isArray(result) ? result[0] : result) as
      | RedeemPromoResult
      | null;

    if (!outcome || outcome.ok === false) {
      const reason = outcome?.reason;
      const mapped =
        (reason ? REASON_MESSAGES[reason] : undefined) ??
        REASON_MESSAGES.not_found;
      return NextResponse.json(
        { error: mapped.error, reason: reason ?? "not_found" },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      ok: true,
      daysGranted: outcome.days_granted ?? 0,
      newExpiry: outcome.new_expiry ?? null,
    });
  } catch (err) {
    console.error("[api/promos/redeem] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
