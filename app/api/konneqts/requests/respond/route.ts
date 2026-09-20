/**
 * POST /api/konneqts/requests/respond — accept or reject a Konneqt request.
 *
 * Body: { requestId: string, action: "accept" | "reject" }
 *
 * Called from the notification panel (bell dropdown + /notifications page)
 * via the Accept ✓ / Reject ✕ buttons on konneqt_request rows.
 *
 * Guards:
 *   - Auth required (cookie session).
 *   - Only the RECIPIENT of the request may respond (403 otherwise).
 *   - Only PENDING requests can be answered — anything else returns 409
 *     { status: <current> } so a stale UI (request already answered on
 *     another device) can settle gracefully instead of erroring hard.
 *
 * Side effects live in lib/konneqts/server.ts (shared with the reverse
 * auto-accept path in POST /api/konneqts): connection row, request state,
 * notifications, analytics, PostHog.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/analytics/server";
import {
  acceptKonneqtRequest,
  rejectKonneqtRequest,
} from "@/lib/konneqts/server";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.requestId === "string" ? body.requestId : null;
    const action = body?.action === "accept" || body?.action === "reject"
      ? body.action
      : null;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "Provide requestId and action (accept|reject)." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: request } = await admin
      .from("konneqt_requests")
      .select("id, requester_id, recipient_id, source, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!request) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 }
      );
    }

    // Only the recipient decides.
    if (request.recipient_id !== user.id) {
      return NextResponse.json(
        { error: "You can't respond to this request." },
        { status: 403 }
      );
    }

    // Already answered elsewhere (another device / the auto-accept path)?
    if (request.status !== "pending") {
      return NextResponse.json(
        { status: request.status, alreadyResolved: true },
        { status: 409 }
      );
    }

    const result =
      action === "accept"
        ? await acceptKonneqtRequest(request)
        : await rejectKonneqtRequest(request);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ status: action === "accept" ? "accepted" : "rejected" });
  } catch (err) {
    console.error("[api/konneqts/requests/respond] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
