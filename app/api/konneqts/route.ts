/**
 * POST /api/konneqts — create a Konneqt (connection) or a guest submission.
 *
 * This single RESTful resource handles two cases based on whether the caller
 * is authenticated:
 *
 * 1. LOGGED-IN → user-to-user connection.
 *    Body: { targetUsername: string, source: string }
 *    - Resolves the target user's primary card by slug.
 *    - Guards: self-connect, deactivated target, already-connected (dedupe).
 *    - Inserts ONE row into `konneqts` (user_a = caller, user_b = target).
 *      One row per relationship — NOT two. The unique least()/greatest()
 *      index guarantees no duplicates regardless of direction.
 *    - Records an analytics event for BOTH users (owner-scoped pattern).
 *    Returns: { status: "konneqted" }
 *
 * 2. ANONYMOUS → guest submission to the target's Konneqts list.
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
import { getAdminClient, recordEvent } from "@/lib/analytics/server";
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

    // Already connected? (The unique index is the hard guarantee, but we
    // pre-check so we can return a clean 409 instead of a DB error.)
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

    // Insert ONE relationship row.
    const { error: insertError } = await admin.from("konneqts").insert({
      user_a: callerId,
      user_b: targetId,
      source,
    });

    if (insertError) {
      // 23505 = unique_violation (race condition hit the dedupe index).
      if (insertError.code === "23505") {
        return NextResponse.json(
          { status: "konneqted", alreadyConnected: true },
          { status: 200 }
        );
      }
      console.error("[api/konneqts] insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Could not create the connection. Please try again." },
        { status: 500 }
      );
    }

    // Analytics: one owner-scoped event for EACH participant, so both
    // dashboards later surface "Konneqts" as a metric. Follows the existing
    // recordEvent pattern (one row per owner's event).
    const callerCard = await admin
      .from("cards")
      .select("id")
      .eq("owner_id", callerId)
      .eq("is_primary", true)
      .maybeSingle();

    const [visitorId, sessionId] = await Promise.all([
      getVisitorId(),
      getSessionId(),
    ]);
    void recordEvent({
      owner_id: callerId,
      card_id: callerCard.data?.id ?? null,
      event_type: "konneqt",
      source,
      visitor_id: visitorId,
      session_id: sessionId,
    });
    void recordEvent({
      owner_id: targetId,
      card_id: targetCard.id,
      event_type: "konneqt",
      source,
      visitor_id: visitorId,
      session_id: sessionId,
    });

    // Product analytics (PostHog) — one funnel event from the ACTOR's
    // perspective. distinctId = Supabase user id, matching the client-side
    // identify() call so both merge into one person.
    void captureEvent(callerId, "konneqt_created", {
      target: targetProfile.username,
      source,
    }).catch(() => {});

    return NextResponse.json({ status: "konneqted" });
  } catch (err) {
    console.error("[api/konneqts] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}