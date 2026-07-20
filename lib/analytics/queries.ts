/**
 * Analytics aggregation queries — power the dashboard charts + the share
 * counter badge.
 *
 * All functions read via the service-role admin client (bypass RLS) because the
 * dashboard page already auth-checks the owner at the route level; we pass the
 * ownerId explicitly so there's no ambiguity.
 *
 * Every function swallows errors and returns an empty/zero shape so a missing
 * migration or a transient DB error degrades the dashboard gracefully instead
 * of 500-ing the page.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "./server";

export type ShareCountInfo = {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
};

/**
 * Count the owner's shares in the current calendar month.
 * This is the canonical source for the 25/month limit.
 */
export async function getMonthlyShareCount(ownerId: string): Promise<ShareCountInfo> {
  // We don't import entitlements here to avoid a circular dependency; the caller
  // resolves the limit and passes it in via getMonthlyShareCountWithLimit.
  const { used, limit, unlimited } = await getMonthlyShareCountWithLimit(ownerId);
  return { used, limit, remaining: Math.max(0, limit - used), unlimited };
}

/**
 * Resolve the monthly share count against a caller-provided limit.
 * Split out so the API route can compute the limit from entitlements and the
 * badge can reuse the same logic.
 */
export async function getMonthlyShareCountWithLimit(
  ownerId: string,
  limit = 25,
  unlimited = false
): Promise<ShareCountInfo> {
  let used = 0;
  try {
    const supabase = getAdminClient();
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("event_type", "share")
      .gte("created_at", from.toISOString());

    if (!error && typeof count === "number") used = count;
  } catch {
    // Non-fatal — treat as zero used.
  }

  const effectiveLimit = unlimited ? Infinity : limit;
  return {
    used,
    limit: effectiveLimit,
    remaining: unlimited ? Infinity : Math.max(0, limit - used),
    unlimited,
  };
}

// ---------------------------------------------------------------------------
// Dashboard series
// ---------------------------------------------------------------------------

export type DayPoint = { date: string; count: number };

/** Daily counts for a single event_type over the last N days (inclusive of today). */
export async function getDailySeries(
  supabase: SupabaseClient,
  ownerId: string,
  eventType: string,
  days: number,
  cardId?: string | null
): Promise<DayPoint[]> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select("created_at")
      .eq("owner_id", ownerId)
      .eq("event_type", eventType)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true });

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return [];

    // Bucket into YYYY-MM-DD.
    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of data) {
      const key = String(row.created_at).slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets, ([date, count]) => ({ date, count }));
  } catch {
    return [];
  }
}

export type ChannelPoint = { date: string; [channel: string]: number | string };

/** Daily share counts broken down by channel (for the stacked bar chart). */
export async function getDailySharesByChannel(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<ChannelPoint[]> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select("created_at, channel")
      .eq("owner_id", ownerId)
      .eq("event_type", "share")
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true });

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return [];

    const buckets = new Map<string, ChannelPoint>();
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10) });
    }
    for (const row of data) {
      const key = String(row.created_at).slice(0, 10);
      const channel = (row.channel as string) || "other";
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket[channel] = ((bucket[channel] as number) ?? 0) + 1;
    }
    return Array.from(buckets.values());
  } catch {
    return [];
  }
}

export type SourcePoint = { source: string; count: number };

/** Top traffic sources (from profile_view events) over the window. */
export async function getTopSources(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<SourcePoint[]> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select("source")
      .eq("owner_id", ownerId)
      .eq("event_type", "profile_view")
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      const s = (row.source as string) || "direct";
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts, ([source, count]) => ({ source, count })).sort(
      (a, b) => b.count - a.count
    );
  } catch {
    return [];
  }
}

export type ChannelConversion = {
  channel: string;
  shares: number;
  views: number;
};

/**
 * Conversion by share channel: shares per channel vs profile views that
 * arrived tagged with that channel's utm_medium / source.
 */
export async function getChannelConversion(
  supabase: SupabaseClient,
  ownerId: string,
  days: number
): Promise<ChannelConversion[]> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const [sharesRes, viewsRes] = await Promise.all([
      supabase
        .from("analytics_events")
        .select("channel")
        .eq("owner_id", ownerId)
        .eq("event_type", "share")
        .gte("created_at", from.toISOString()),
      supabase
        .from("analytics_events")
        .select("source")
        .eq("owner_id", ownerId)
        .eq("event_type", "profile_view")
        .gte("created_at", from.toISOString()),
    ]);

    const shareMap = new Map<string, number>();
    for (const r of sharesRes.data ?? []) {
      const c = (r.channel as string) || "other";
      shareMap.set(c, (shareMap.get(c) ?? 0) + 1);
    }
    const viewMap = new Map<string, number>();
    for (const r of viewsRes.data ?? []) {
      const s = (r.source as string) || "direct";
      viewMap.set(s, (viewMap.get(s) ?? 0) + 1);
    }

    const channels = new Set([...shareMap.keys(), ...viewMap.keys()]);
    return Array.from(channels).map((channel) => ({
      channel,
      shares: shareMap.get(channel) ?? 0,
      views: viewMap.get(channel) ?? 0,
    })).sort((a, b) => b.shares - a.shares);
  } catch {
    return [];
  }
}

export type VisitorStats = {
  unique: number;
  returning: number;
};

/** Unique vs returning visitors over the window (by visitor_id). */
export async function getVisitorStats(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<VisitorStats> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select("visitor_id")
      .eq("owner_id", ownerId)
      .eq("event_type", "profile_view")
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return { unique: 0, returning: 0 };

    const counts = new Map<string, number>();
    for (const row of data) {
      const id = (row.visitor_id as string) || "anon";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    let unique = 0;
    let returning = 0;
    for (const c of counts.values()) {
      unique += 1;
      if (c > 1) returning += 1;
    }
    return { unique, returning };
  } catch {
    return { unique: 0, returning: 0 };
  }
}

export type GeoPoint = { label: string; count: number };

/** Top countries (or cities) by profile views over the window. */
export async function getGeoDistribution(
  supabase: SupabaseClient,
  ownerId: string,
  field: "country" | "city",
  days: number,
  cardId?: string | null
): Promise<GeoPoint[]> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select(field)
      .eq("owner_id", ownerId)
      .eq("event_type", "profile_view")
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      const v = ((row as Record<string, unknown>)[field] as string) || "Unknown";
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts, ([label, count]) => ({ label, count })).sort(
      (a, b) => b.count - a.count
    );
  } catch {
    return [];
  }
}

export type Totals = {
  views: number;
  shares: number;
  qrScans: number;
  vcardDownloads: number;
};

/** Headline totals over the window (for the stat cards). */
export async function getTotals(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<Totals> {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    let query = supabase
      .from("analytics_events")
      .select("event_type")
      .eq("owner_id", ownerId)
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return { views: 0, shares: 0, qrScans: 0, vcardDownloads: 0 };

    const totals: Totals = { views: 0, shares: 0, qrScans: 0, vcardDownloads: 0 };
    for (const row of data) {
      switch (row.event_type) {
        case "profile_view":
          totals.views += 1;
          break;
        case "share":
          totals.shares += 1;
          break;
        case "qr_scan":
          totals.qrScans += 1;
          break;
        case "vcard_download":
          totals.vcardDownloads += 1;
          break;
      }
    }
    return totals;
  } catch {
    return { views: 0, shares: 0, qrScans: 0, vcardDownloads: 0 };
  }
}