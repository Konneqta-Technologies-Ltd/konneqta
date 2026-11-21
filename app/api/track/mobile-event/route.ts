/**
 * POST /api/track/mobile-event — analytics events recorded by the Konneqta
 * MOBILE app. The mobile equivalent of the web's beacons:
 *
 *   • the web's ProfileCard fires /api/track/link-click on social-link taps
 *   • the web's /[username] page records profile_view server-side on render
 *
 * In the app BOTH happen from this one route (the app has no page render to
 * hook): viewing a profile in-app and tapping its links are counted with the
 * SAME rules as the web (docs/analytics-plan.md):
 *   • the card OWNER's own views/clicks are never recorded
 *   • profile_view is de-duplicated per viewer per 30-minute session
 *     (recordProfileViewOnce)
 *   • unknown username / bad payload → 204, never an error
 *
 * Identity: the caller's Supabase user (Bearer token) IS the visitor — the
 * app is auth-first, so visitor_id derives from the user id and the session
 * from a 30-minute time bucket (same window as the web's kq_sid cookie; a
 * fixed bucket instead of a sliding window is the only approximation).
 *
 * Body: { type: 'profile_view' | 'link_click' | 'vcard_download',
 *         username: string, source?: 'app' | 'qr', platform?: string }
 *   source 'qr'  — the profile was opened from a scanned card QR (the
 *                  dashboard derives QR scans from profile_view + source).
 *   platform     — link_click only: the social platform tapped (channel).
 *
 * Auth: Bearer-only in practice (the mobile sends it), but the dual-auth
 * helper is used so the shape matches every other mobile-facing route.
 */

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/request-auth";
import { parseGeo } from "@/lib/analytics/geo";
import {
  recordEvent,
  recordProfileViewOnce,
} from "@/lib/analytics/server";

const SESSION_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: Request) {
  try {
    // Bad payload / unauthenticated / unknown card / self-event → 204.
    // Analytics can never break (or leak errors to) the caller.
    const { supabase, user } = await getUserFromRequest(req);
    if (!user) return new NextResponse(null, { status: 204 });

    const body = (await req.json().catch(() => null)) as {
      type?: unknown;
      username?: unknown;
      source?: unknown;
      platform?: unknown;
    } | null;

    const type =
      body?.type === "profile_view" ||
      body?.type === "link_click" ||
      body?.type === "vcard_download"
        ? body.type
        : null;
    const username =
      typeof body?.username === "string" ? body.username.trim().slice(0, 60) : "";
    if (!type || !username) return new NextResponse(null, { status: 204 });

    const source = body?.source === "qr" ? "qr" : "app";
    const platform =
      typeof body?.platform === "string"
        ? body.platform.trim().toLowerCase().slice(0, 40)
        : null;

    // Resolve the card by slug (public read — same lookup as the web page).
    const { data: card } = await supabase
      .from("cards")
      .select("id, owner_id")
      .eq("slug", username)
      .maybeSingle();
    if (!card) return new NextResponse(null, { status: 204 });

    // The owner's own views/clicks never count (mirrors the web rules).
    if (user.id === card.owner_id) return new NextResponse(null, { status: 204 });

    // Mobile visitor/session identity — stable per account + 30-min bucket.
    const bucket = Math.floor(Date.now() / SESSION_WINDOW_MS);
    const visitorId = `m-u:${user.id}`;
    const sessionId = `m-s:${user.id}:${bucket}`;
    const geo = parseGeo((name) => req.headers.get(name));

    if (type === "profile_view") {
      await recordProfileViewOnce({
        owner_id: card.owner_id,
        card_id: card.id,
        source,
        visitor_id: visitorId,
        session_id: sessionId,
        country: geo.country,
        city: geo.city,
      });
    } else {
      // link_click + vcard_download — plain events, NO dedupe (the web's
      // vCard route counts every download; same for clicks).
      await recordEvent({
        owner_id: card.owner_id,
        card_id: card.id,
        event_type: type,
        channel: type === "link_click" ? platform : null,
        source,
        visitor_id: visitorId,
        session_id: sessionId,
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    // Never surface analytics errors to the client.
    return new NextResponse(null, { status: 204 });
  }
}