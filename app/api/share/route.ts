/**
 * POST /api/share — record a share and enforce the monthly limit.
 *
 * Body: { username: string, channel?: string, cardId?: string }
 *
 * Flow:
 *   1. Auth-check the caller (must be the owner of the card).
 *   2. Resolve the owner's entitlements → limit (25 free, ∞ pro/exempt).
 *   3. Count this month's existing share events for the owner.
 *   4. If at/over limit and not unlimited → 429 (blocked).
 *   5. Otherwise insert a `share` event → return updated remaining count.
 *
 * The limit is enforced HERE (server-side), never in the client, so editing
 * frontend code cannot bypass it.
 */

import { getMaxShares, isPro } from "@/lib/entitlements";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getMonthlyShareCountWithLimit } from "@/lib/analytics/queries";
import { recordEvent } from "@/lib/analytics/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username : null;
    const channel =
      typeof body.channel === "string" ? body.channel.toLowerCase() : "native";
    const cardId =
      typeof body.cardId === "string" && body.cardId ? body.cardId : null;

    if (!username) {
      return NextResponse.json({ error: "Missing username." }, { status: 400 });
    }

    // --- Auth: verify the caller's session via cookie ---------------------
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

    // --- Resolve the card + owner + entitlements --------------------------
    // Look up the card by slug. Confirm it belongs to the caller so a user
    // can't record shares against someone else's card.
    const { data: card } = await supabase
      .from("cards")
      .select("id, owner_id, slug")
      .eq("slug", username)
      .maybeSingle();

    if (!card) {
      return NextResponse.json({ error: "Card not found." }, { status: 404 });
    }

    if (card.owner_id !== user.id) {
      return NextResponse.json(
        { error: "You can only share your own card." },
        { status: 403 }
      );
    }

    // Fetch the owner's entitlements.
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, username, plan, is_exempt, pro_expires_at")
      .eq("id", card.owner_id)
      .maybeSingle();

    const ownerPro = isPro(owner);
    const limit = getMaxShares(owner);
    const unlimited = ownerPro || limit === Infinity;

    // --- Limit check ------------------------------------------------------
    const before = await getMonthlyShareCountWithLimit(
      card.owner_id,
      unlimited ? Infinity : limit,
      unlimited
    );

    if (!unlimited && before.used >= limit) {
      return NextResponse.json(
        {
          blocked: true,
          reason: "monthly_limit",
          used: before.used,
          limit,
          remaining: 0,
        },
        { status: 429 }
      );
    }

    // --- Record the share -------------------------------------------------
    await recordEvent({
      owner_id: card.owner_id,
      card_id: card.id,
      event_type: "share",
      channel,
    });

    // Recompute the count after the insert so the badge ticks down live.
    const after = await getMonthlyShareCountWithLimit(
      card.owner_id,
      unlimited ? Infinity : limit,
      unlimited
    );

    return NextResponse.json({
      ok: true,
      used: after.used,
      limit: after.limit,
      remaining: after.remaining,
      unlimited: after.unlimited,
    });
  } catch (err) {
    console.error("[api/share] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}