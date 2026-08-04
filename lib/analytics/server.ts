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
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
  | "qr_scan"
  | "vcard_download"
  | "konneqt";

export type RecordEventInput = {
  owner_id: string;
  card_id?: string | null;
  event_type: AnalyticsEventType;
  channel?: string | null;
  source?: string | null;
  visitor_id?: string | null;
  country?: string | null;
  city?: string | null;
};

/**
 * Insert a single analytics event. Fire-and-forget by design — the caller
 * `await`s, but any failure is logged and swallowed so a tracking hiccup can
 * NEVER break a page render, a share, or a vCard download.
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
      country: input.country ?? null,
      city: input.city ?? null,
    });
    if (error) {
      // Expected if the migration hasn't been run yet — safe to ignore.
      console.warn("[analytics] recordEvent insert failed:", error.message);
    }
  } catch (err) {
    // Never let analytics break the user-facing flow.
    console.warn("[analytics] recordEvent error (non-fatal):", err);
  }
}