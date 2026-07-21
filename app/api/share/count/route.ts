/**
 * GET /api/share/count — current monthly share usage for the signed-in user.
 *
 * Returns: { used, limit, remaining, unlimited }
 *
 * Powers the top-right "12/25" badge. Auth-required; always scoped to the
 * caller's own usage.
 */

import { getMaxShares, isPro } from "@/lib/entitlements";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getMonthlyShareCountWithLimit } from "@/lib/analytics/queries";

export async function GET() {
  try {
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

    // Fetch the owner's entitlements to resolve the limit + unlimited flag.
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, username, plan, is_exempt, pro_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    const ownerPro = isPro(owner);
    const limit = getMaxShares(owner);
    const unlimited = ownerPro || limit === Infinity;

    const info = await getMonthlyShareCountWithLimit(
      user.id,
      unlimited ? Infinity : limit,
      unlimited
    );

    return NextResponse.json(info);
  } catch (err) {
    console.error("[api/share/count] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}