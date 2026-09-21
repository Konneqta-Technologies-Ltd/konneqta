/**
 * GET /api/konneqts/status?targetUsername=… — connection state between the
 * signed-in caller and a target profile.
 *
 * Returns: { connected, requested }
 *   - connected = true  → a konneqts row exists for the pair (button shows
 *                          "✓ Konneqted"; permanent — one exchange per pair).
 *   - requested = true  → the CALLER has an outgoing PENDING request (button
 *                          shows "Requested"; cannot repeat).
 *   - both false        → the button offers Connect. (If the TARGET has a
 *                          pending request aimed at the caller, we still
 *                          report idle — clicking Connect auto-accepts it
 *                          server-side, which is the nicer outcome.)
 *
 * Used by ConnectButton on mount so returning visitors see the right state.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/analytics/server";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const targetUsername = req.nextUrl.searchParams
      .get("targetUsername")
      ?.trim();
    if (!targetUsername) {
      return NextResponse.json(
        { error: "Missing target username." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Resolve the target user via their primary card slug (same as POST).
    const { data: targetCard } = await admin
      .from("cards")
      .select("id, owner_id, slug")
      .eq("slug", targetUsername)
      .maybeSingle();

    if (!targetCard) {
      return NextResponse.json(
        { error: "Target profile not found." },
        { status: 404 }
      );
    }

    if (targetCard.owner_id === user.id) {
      // Own profile — nothing to request. (ProfileCard hides the button for
      // owners anyway; this keeps the endpoint honest.)
      return NextResponse.json({ connected: false, requested: false });
    }

    const callerId = user.id;
    const targetId = targetCard.owner_id;

    const [konneqtRes, requestRes] = await Promise.all([
      admin
        .from("konneqts")
        .select("id")
        .or(
          `and(user_a.eq.${callerId},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${callerId})`
        )
        .maybeSingle(),
      admin
        .from("konneqt_requests")
        .select("id")
        .eq("status", "pending")
        .eq("requester_id", callerId)
        .eq("recipient_id", targetId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      connected: !!konneqtRes.data,
      requested: !!requestRes.data,
    });
  } catch (err) {
    console.error("[api/konneqts/status] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
