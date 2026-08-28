/**
 * POST /api/track/link-click — record a social-link click on a profile card.
 *
 * Called via navigator.sendBeacon (or a keepalive fetch fallback) from
 * ProfileCard. Beacons are fire-and-forget: the browser guarantees delivery
 * even while the link navigation is already in flight, and the click is
 * never delayed.
 *
 * Body: { username: string, platform: string }  (channel stores the platform)
 *
 * Counting rules (mirror the profile-view rules — see docs/analytics-plan.md):
 *   • The card OWNER clicking their own links is NOT counted.
 *   • Known bots/crawlers are NOT counted.
 *   • Visitors who declined cookies still count (each click is an anonymous
 *     aggregate action, like a pageview) but can't be attributed to a
 *     visitor/session.
 *
 * Anti-forgery: beacons are same-origin, so a cross-site forged POST with an
 * Origin header is rejected. The endpoint accepts only tiny string payloads
 * and writes exactly one row — spam is possible in theory (as with any
 * beacon analytics) but only inflates the owner's own chart.
 */

import { getSessionId } from "@/lib/analytics/session";
import { getVisitorId } from "@/lib/analytics/visitor";
import { isBotUserAgent } from "@/lib/analytics/bot";
import { recordEvent } from "@/lib/analytics/server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    // Beacons may arrive as application/json (Blob) or text/plain (string).
    let body: unknown = null;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await req.json().catch(() => null);
    } else {
      const text = await req.text().catch(() => "");
      if (text) body = JSON.parse(text);
    }

    const username =
      body && typeof body === "object" && typeof (body as { username?: unknown }).username === "string"
        ? (body as { username: string }).username.trim().slice(0, 60)
        : null;
    const platform =
      body && typeof body === "object" && typeof (body as { platform?: unknown }).platform === "string"
        ? (body as { platform: string }).platform.trim().toLowerCase().slice(0, 40)
        : null;

    if (!username || !platform) {
      return new NextResponse(null, { status: 204 });
    }

    // Same-origin guard: browsers always send Origin on cross-origin POSTs.
    // If an Origin header is present and points elsewhere, drop the beacon.
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        const originHost = new URL(origin).hostname;
        const requestHost = req.headers.get("host");
        if (requestHost && originHost !== requestHost.split(":")[0]) {
          return new NextResponse(null, { status: 403 });
        }
      } catch {
        return new NextResponse(null, { status: 403 });
      }
    }

    // Bots never count.
    if (isBotUserAgent(req.headers.get("user-agent"))) {
      return new NextResponse(null, { status: 204 });
    }

    // Resolve the card (public read via the anon server client).
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

    const { data: card } = await supabase
      .from("cards")
      .select("id, owner_id")
      .eq("slug", username)
      .maybeSingle();

    if (!card) {
      return new NextResponse(null, { status: 204 });
    }

    // The owner clicking their own links must not count.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id === card.owner_id) {
      return new NextResponse(null, { status: 204 });
    }

    const [visitorId, sessionId] = await Promise.all([getVisitorId(), getSessionId()]);

    await recordEvent({
      owner_id: card.owner_id,
      card_id: card.id,
      event_type: "link_click",
      channel: platform,
      visitor_id: visitorId,
      session_id: sessionId,
    });

    // Beacons can't read the response — 204 keeps it cheap.
    return new NextResponse(null, { status: 204 });
  } catch {
    // Never surface analytics errors to the client.
    return new NextResponse(null, { status: 204 });
  }
}
