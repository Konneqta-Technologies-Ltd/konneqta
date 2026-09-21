/**
 * POST /api/konneqts — send a Konneqt (exchange-contact) REQUEST or a guest
 * submission.
 *
 * This single RESTful resource handles two cases based on whether the caller
 * is authenticated:
 *
 * 1. LOGGED-IN → user-to-user connection REQUEST (consent flow).
 *    Body: { targetUsername: string, source: string }
 *    - Resolves the target user's primary card by slug.
 *    - Guards: self-connect, deactivated target, already-connected (one
 *      exchange per pair — settles as "konneqted").
 *    - Pending request handling (one pending request per pair, either
 *      direction — the partial unique index is the hard guarantee):
 *        · Caller already has an outgoing pending request → 200
 *          { status: "request_pending" } (no repeat requests).
 *        · The TARGET had already requested the CALLER → mutual intent →
 *          their pending request is ACCEPTED instantly and the pair is
 *          connected ({ status: "konneqted", viaAutoAccept: true }).
 *    - Otherwise inserts a pending `konneqt_requests` row and notifies the
 *      recipient with an actionable konneqt_request notification (Accept /
 *      Reject in the notification panel). The connection itself is only
 *      created when they accept (see /api/konneqts/requests/respond and
 *      lib/konneqts/server.ts for the accept side effects).
 *    Returns: { status: "requested" }
 *
 * 2. ANONYMOUS → guest submission to the target's Konneqts list (unchanged).
 *    Body: { targetUsername: string, source: "GUEST_FORM",
 *            guestName: string, phone?: string, note?: string }
 *    - Inserts into `guest_konneqts` (separate entity).
 *    - Records one analytics event for the target.
 *    Returns: { status: "guest_submitted" }
 *
 * WRITES USE THE SERVICE-ROLE ADMIN CLIENT — this bypasses RLS so we can write
 * the bidirectional relationship in one authenticated call. The anon key has
 * no insert policy and cannot fabricate connections from the browser.
 */

import { KONNEQT_SOURCES, VALID_SOURCES } from "@/lib/konneqts";
import { acceptKonneqtRequest } from "@/lib/konneqts/server";
import { getAdminClient, recordEvent } from "@/lib/analytics/server";
import { createNotification } from "@/lib/notifications/server";
import { getSessionId } from "@/lib/analytics/session";
import { getVisitorId } from "@/lib/analytics/visitor";
import { captureEvent } from "@/lib/posthog";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Sanity caps on guest-submitted text (prevents abuse).
const MAX_NAME = 120;
const MAX_PHONE = 60;
const MAX_NOTE = 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUsername =
      typeof body.targetUsername === "string" ? body.targetUsername.trim() : null;
    const source =
      typeof body.source === "string" ? body.source.toUpperCase() : null;

    if (!targetUsername) {
      return NextResponse.json(
        { error: "Missing target username." },
        { status: 400 }
      );
    }
    if (!source || !VALID_SOURCES.has(source)) {
      return NextResponse.json(
        { error: "Invalid or missing source." },
        { status: 400 }
      );
    }

    // ── Resolve the caller's session (cookie-based) ───────────────────────
    const cookieStore = await cookies();
    const userSupabase = createServerClient(
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
    } = await userSupabase.auth.getUser();

    // Service-role client for all writes (bypasses RLS).
    const admin = getAdminClient();

    // ── Resolve the target user via their primary card slug ───────────────
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

    // Confirm the target profile is active (not deactivated).
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, username, status")
      .eq("id", targetCard.owner_id)
      .maybeSingle();

    if (!targetProfile || targetProfile.status === "deactivated") {
      return NextResponse.json(
        { error: "Target profile not found." },
        { status: 404 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CASE 2: ANONYMOUS GUEST SUBMISSION
    // ═══════════════════════════════════════════════════════════════════════
    if (!user) {
      const guestName =
        typeof body.guestName === "string" ? body.guestName.trim() : "";
      const phone =
        typeof body.phone === "string" ? body.phone.trim().slice(0, MAX_PHONE) : null;
      const note =
        typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : null;

      if (!guestName) {
        return NextResponse.json(
          { error: "Name is required." },
          { status: 400 }
        );
      }
      if (guestName.length > MAX_NAME) {
        return NextResponse.json(
          { error: "Name is too long." },
          { status: 400 }
        );
      }

      const { error: insertError } = await admin
        .from("guest_konneqts")
        .insert({
          owner_id: targetCard.owner_id,
          guest_name: guestName,
          guest_phone: phone || null,
          message: note || null,
          source: KONNEQT_SOURCES.GUEST_FORM,
        });

      if (insertError) {
        console.error("[api/konneqts] guest insert failed:", insertError.message);
        return NextResponse.json(
          { error: "Could not submit your details. Please try again." },
          { status: 500 }
        );
      }

      // Analytics: one event scoped to the target owner.
      const [guestVisitorId, guestSessionId] = await Promise.all([
        getVisitorId(),
        getSessionId(),
      ]);
      void recordEvent({
        owner_id: targetCard.owner_id,
        card_id: targetCard.id,
        event_type: "konneqt",
        source: KONNEQT_SOURCES.GUEST_FORM,
        visitor_id: guestVisitorId,
        session_id: guestSessionId,
      });

      // Notify the card owner (in-app + push, preference-aware, non-fatal).
      void createNotification({
        userId: targetCard.owner_id,
        type: "guest_konneqt",
        title: `${guestName} shared their details with you`,
        body: "Open your Konneqts to see their contact info.",
        link: `/${targetUsername}/konneqts`,
      });

      return NextResponse.json({ status: "guest_submitted" });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CASE 1: LOGGED-IN USER-TO-USER CONNECTION
    // ═══════════════════════════════════════════════════════════════════════
    const callerId = user.id;
    const targetId = targetCard.owner_id;

    // Self-connect guard.
    if (callerId === targetId) {
      return NextResponse.json(
        { error: "You can't Konneqt with yourself." },
        { status: 400 }
      );
    }

    // Already connected? One exchange per pair — settled forever. (The
    // unique index is the hard guarantee; this pre-check returns cleanly.)
    const { data: existing } = await admin
      .from("konneqts")
      .select("id")
      .or(
        `and(user_a.eq.${callerId},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${callerId})`
      )
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { status: "konneqted", alreadyConnected: true },
        { status: 200 }
      );
    }

    // Pending request between the pair (either direction)? The partial
    // unique index enforces "one pending per pair" — we pre-check to give
    // each direction its own clean response.
    const { data: pendingReq } = await admin
      .from("konneqt_requests")
      .select("id, requester_id, recipient_id, source")
      .eq("status", "pending")
      .or(
        `and(requester_id.eq.${callerId},recipient_id.eq.${targetId}),and(requester_id.eq.${targetId},recipient_id.eq.${callerId})`
      )
      .maybeSingle();

    if (pendingReq) {
      if (pendingReq.requester_id === targetId) {
        // The TARGET already requested the CALLER → mutual intent: accept
        // their pending request instead of duplicating it in reverse.
        const result = await acceptKonneqtRequest(pendingReq);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          );
        }
        return NextResponse.json({
          status: "konneqted",
          viaAutoAccept: true,
        });
      }
      // The caller already has an outgoing pending request → no repeats.
      return NextResponse.json(
        { status: "request_pending", alreadyRequested: true },
        { status: 200 }
      );
    }

    // Insert the pending request (the recipient decides).
    const { data: newRequest, error: requestError } = await admin
      .from("konneqt_requests")
      .insert({
        requester_id: callerId,
        recipient_id: targetId,
        source,
      })
      .select("id")
      .single();

    if (requestError) {
      // 23505 = unique_violation (race hit the one-pending-per-pair index).
      if (requestError.code === "23505") {
        return NextResponse.json(
          { status: "request_pending", alreadyRequested: true },
          { status: 200 }
        );
      }
      console.error("[api/konneqts] request insert failed:", requestError.message);
      return NextResponse.json(
        { error: "Could not send the request. Please try again." },
        { status: 500 }
      );
    }

    // Display name for the recipient's notification (falls back to @username).
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", callerId)
      .maybeSingle();

    const callerName =
      callerProfile?.full_name?.trim() ||
      (callerProfile?.username ? `@${callerProfile.username}` : "Someone new");

    // Notify the recipient: an actionable konneqt_request notification that
    // renders Accept / Reject buttons in the notification panel. Tapping the
    // row itself deep-links to the requester's profile so they can decide.
    // (In-app + push, preference-aware, non-fatal.)
    void createNotification({
      userId: targetId,
      type: "konneqt_request",
      title: `${callerName} wants to Konneqt with you`,
      body: "Accept to exchange contacts — you'll both appear in each other's Konneqts.",
      link: callerProfile?.username ? `/${callerProfile.username}` : null,
      data: {
        requestId: newRequest.id,
        requestStatus: "pending",
        requesterUsername: callerProfile?.username ?? null,
      },
    });

    // Product analytics (PostHog) — request sent from the ACTOR's
    // perspective. distinctId = Supabase user id, matching the client-side
    // identify() call so both merge into one person. The konneqt_created /
    // `konneqt` analytics events fire at ACCEPT time (lib/konneqts/server.ts),
    // when the connection actually forms.
    void captureEvent(callerId, "konneqt_request_sent", {
      target: targetProfile.username,
      source,
    }).catch(() => {});

    return NextResponse.json({
      status: "requested",
      requestId: newRequest.id,
    });
  } catch (err) {
    console.error("[api/konneqts] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}