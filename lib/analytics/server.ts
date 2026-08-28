/**
 * Analytics server helpers — service-role DB access + fire-and-forget event
 * recording.
 *
 * SECURITY
 * --------
 * All writes to `analytics_events` happen here using the service-role key,
 * which bypasses RLS. The client (anon key) has NO insert policy, so it's
 * impossible to fabricate or tamper with events from the browser. This module
 * is server-only — never import it from a client component.
 *
 * v2 COUNTING RULES (enforced by callers + recordProfileViewOnce below):
 *   • Owner self-views/clicks/downloads are never recorded (caller checks).
 *   • Bots/crawlers are never recorded (lib/analytics/bot.ts, caller checks).
 *   • profile_view is de-duplicated per visitor per 30-min session.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";

let admin: SupabaseClient | null = null;

/**
 * Lazily-built service-role Supabase client (singleton).
 * Uses SUPABASE_SERVICE_ROLE_KEY which is server-only (no NEXT_PUBLIC_ prefix).
 */
export function getAdminClient(): SupabaseClient {
  if (!admin) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not set. Analytics writes require it."
      );
    }
    admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return admin;
}

export type AnalyticsEventType =
  | "profile_view"
  | "share"
  | "vcard_download"
  | "link_click"
  | "konneqt";

export type RecordEventInput = {
  owner_id: string;
  card_id?: string | null;
  event_type: AnalyticsEventType;
  channel?: string | null;
  source?: string | null;
  visitor_id?: string | null;
  session_id?: string | null;
  country?: string | null;
  city?: string | null;
};

/**
 * Report an analytics failure: logged + a Sentry breadcrumb. Errors are
 * swallowed by design so analytics can NEVER break a page render, a share,
 * or a vCard download — but the breadcrumb means any later Sentry error in
 * the same request carries proof that events were being dropped, instead of
 * the data loss staying completely silent.
 */
function reportFailure(context: string, err: unknown): void {
  console.warn(`[analytics] ${context} (non-fatal):`, err);
  try {
    Sentry.addBreadcrumb({
      category: "analytics",
      level: "warning",
      message: `${context}: ${err instanceof Error ? err.message : String(err)}`,
    });
  } catch {
    // Sentry not initialized (e.g. local dev) — ignore.
  }
}

/**
 * Insert a single analytics event. Fire-and-forget by design — the caller
 * `await`s (or wraps in next/server `after()`), but any failure is logged
 * and swallowed so a tracking hiccup can NEVER break the user-facing flow.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const supabase = getAdminClient();
    const { error } = await supabase.from("analytics_events").insert({
      owner_id: input.owner_id,
      card_id: input.card_id ?? null,
      event_type: input.event_type,
      channel: input.channel ?? null,
      source: input.source ?? null,
      visitor_id: input.visitor_id ?? null,
      session_id: input.session_id ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
    });
    if (error) {
      // Expected if the migration hasn't been run yet — safe to ignore.
      reportFailure("recordEvent insert failed", error.message);
    }
  } catch (err) {
    reportFailure("recordEvent error", err);
  }
}

/**
 * Record a profile view ONCE per visitor per 30-minute session per card.
 *
 * A refresh, a quick tab-back-and-forth, or a flip back to the profile inside
 * the same session does NOT create a second row — "views" on the dashboard
 * mean real visits, not raw renders. The check runs before the insert so the
 * table itself stays duplicate-free.
 *
 * Visitors without a visitor+session cookie pair (pre-consent or cookieless)
 * can't be de-duplicated — the anonymous view is recorded rather than lost.
 */
export async function recordProfileViewOnce(input: {
  owner_id: string;
  card_id: string;
  source: string;
  visitor_id: string | null;
  session_id: string | null;
  country: string | null;
  city: string | null;
}): Promise<void> {
  try {
    const supabase = getAdminClient();

    if (input.visitor_id && input.session_id) {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("id")
        .eq("owner_id", input.owner_id)
        .eq("card_id", input.card_id)
        .eq("event_type", "profile_view")
        .eq("visitor_id", input.visitor_id)
        .eq("session_id", input.session_id)
        .limit(1);

      if (error) {
        // Fall through and record — a rare duplicate beats a lost view.
        reportFailure("profile-view dedupe check failed", error.message);
      } else if (data && data.length > 0) {
        // Already counted for this session — this render is a refresh.
        return;
      }
    }

    await recordEvent({ ...input, event_type: "profile_view" });
  } catch (err) {
    reportFailure("recordProfileViewOnce error", err);
  }
}
