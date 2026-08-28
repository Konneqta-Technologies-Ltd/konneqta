/**
 * Analytics aggregation queries — power the dashboard charts + the share
 * counter badge.
 *
 * v2 strategy:
 *   1. getDashboardData() calls the `analytics_dashboard` Postgres RPC —
 *      every chart is aggregated inside the database in ONE round-trip
 *      (supabase/analytics-v2-upgrade.sql).
 *   2. If the RPC is unavailable (migration not run yet / transient error),
 *      the JS fallback functions below produce the SAME shapes by fetching
 *      raw rows — the dashboard degrades gracefully, never 500s.
 *
 * v2 counting semantics (see docs/analytics-plan.md):
 *   • Owner self-views and bots are filtered at WRITE time, never stored.
 *   • profile_view is de-duplicated per visitor per 30-minute session.
 *   • QR scans = profile_view rows with source='qr' (no separate event).
 *   • Returning visitor = visitor_id with >1 distinct session in the window.
 *   • Day buckets are UTC (dashboard labels say so).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "./server";

// ---------------------------------------------------------------------------
// Share limit (25/month) — canonical source for the badge + /api/share gate
// ---------------------------------------------------------------------------

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
// Dashboard types
// ---------------------------------------------------------------------------

export type DayPoint = { date: string; count: number };
export type ChannelPoint = { date: string; [channel: string]: number | string };
export type SourcePoint = { source: string; count: number };
export type LinkPoint = { link: string; count: number };
export type ChannelConversion = {
  channel: string;
  shares: number;
  views: number;
};
export type VisitorStats = {
  unique: number;
  returning: number;
};
export type GeoPoint = { label: string; count: number };

export type Totals = {
  views: number;
  shares: number;
  /** Profile views that arrived via a QR code (source='qr'). */
  qrScans: number;
  vcardDownloads: number;
  /** Social-link clicks on the card (link_click events). */
  linkClicks: number;
  /** Connections made (konneqt events). */
  konneqts: number;
};

export type DashboardData = {
  totals: Totals;
  /** Same-length window immediately before the selected one (for deltas). */
  prevTotals: Totals;
  viewsSeries: DayPoint[];
  sharesByChannel: ChannelPoint[];
  topSources: SourcePoint[];
  topLinks: LinkPoint[];
  channelConversion: ChannelConversion[];
  visitorStats: VisitorStats;
  geoCountries: GeoPoint[];
  geoCities: GeoPoint[];
};

const EMPTY_TOTALS: Totals = {
  views: 0,
  shares: 0,
  qrScans: 0,
  vcardDownloads: 0,
  linkClicks: 0,
  konneqts: 0,
};

const MS_PER_DAY = 86_400_000;

/**
 * Inclusive UTC-midnight start of a `days`-long window, `offsetWindows`
 * whole windows back from today. offset 0 = current window, 1 = previous.
 */
function windowStartUtc(days: number, offsetWindows = 0): Date {
  const now = new Date();
  const utcDayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return new Date(
    utcDayStart - offsetWindows * days * MS_PER_DAY - (days - 1) * MS_PER_DAY
  );
}

// ---------------------------------------------------------------------------
// Dashboard entry point — RPC first, JS row-fetch fallback
// ---------------------------------------------------------------------------

/**
 * Fetch EVERYTHING the dashboard needs in ONE database round-trip via the
 * analytics_dashboard RPC. Falls back to the per-chart JS functions when the
 * RPC is missing (migration not run) or errors.
 */
export async function getDashboardData(
  admin: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<DashboardData> {
  try {
    const { data, error } = await admin.rpc("analytics_dashboard", {
      p_owner_id: ownerId,
      p_days: days,
      p_card_id: cardId ?? null,
    });
    if (!error && data) {
      return mapRpcResult(data as Record<string, unknown>, days);
    }
    console.warn(
      "[analytics] analytics_dashboard RPC unavailable, using row fallback:",
      error?.message
    );
  } catch (err) {
    console.warn("[analytics] analytics_dashboard RPC threw, using row fallback:", err);
  }
  return getDashboardDataFallback(admin, ownerId, days, cardId);
}

type RpcRow = Record<string, unknown>;

function rpcNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function totalsFromRpc(input: unknown): Totals {
  const o = (input ?? {}) as RpcRow;
  return {
    views: rpcNum(o.views),
    shares: rpcNum(o.shares),
    qrScans: rpcNum(o.qrScans),
    vcardDownloads: rpcNum(o.vcardDownloads),
    linkClicks: rpcNum(o.linkClicks),
    konneqts: rpcNum(o.konneqts),
  };
}

/** Map the RPC's jsonb payload onto the DashboardData shape (defensive). */
function mapRpcResult(raw: RpcRow, days: number): DashboardData {
  const asRows = (value: unknown): RpcRow[] =>
    Array.isArray(value) ? (value as RpcRow[]) : [];

  const viewsSeries: DayPoint[] = asRows(raw.viewsSeries).map((r) => ({
    date: String(r.date),
    count: rpcNum(r.count),
  }));

  const topSources: SourcePoint[] = asRows(raw.topSources).map((r) => ({
    source: String(r.source),
    count: rpcNum(r.count),
  }));

  const topLinks: LinkPoint[] = asRows(raw.topLinks).map((r) => ({
    link: String(r.link),
    count: rpcNum(r.count),
  }));

  const channelConversion: ChannelConversion[] = asRows(raw.channelConversion).map(
    (r) => ({
      channel: String(r.channel),
      shares: rpcNum(r.shares),
      views: rpcNum(r.views),
    })
  );

  const geoCountries: GeoPoint[] = asRows(raw.geoCountries).map((r) => ({
    label: String(r.label),
    count: rpcNum(r.count),
  }));

  const geoCities: GeoPoint[] = asRows(raw.geoCities).map((r) => ({
    label: String(r.label),
    count: rpcNum(r.count),
  }));

  const visitorRow = (raw.visitorStats ?? {}) as RpcRow;
  const visitorStats: VisitorStats = {
    unique: rpcNum(visitorRow.unique),
    returning: rpcNum(visitorRow.returning),
  };

  // Pivot the long-format share channels into zero-filled chart rows.
  const sharesByChannel = pivotShareChannels(
    asRows(raw.shareChannels).map((r) => ({
      date: String(r.date),
      channel: String(r.channel ?? "other"),
      count: rpcNum(r.count),
    })),
    days
  );

  return {
    totals: totalsFromRpc(raw.totals),
    prevTotals: totalsFromRpc(raw.prevTotals),
    viewsSeries,
    sharesByChannel,
    topSources,
    topLinks,
    channelConversion,
    visitorStats,
    geoCountries,
    geoCities,
  };
}

/** Pivot {date, channel, count} rows into zero-filled {date, [channel]: n} rows. */
function pivotShareChannels(
  rows: { date: string; channel: string; count: number }[],
  days: number
): ChannelPoint[] {
  const start = windowStartUtc(days);
  const buckets = new Map<string, ChannelPoint>();
  for (let i = 0; i < days; i++) {
    const key = new Date(start.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10);
    buckets.set(key, { date: key });
  }
  for (const row of rows) {
    const bucket = buckets.get(row.date);
    if (!bucket) continue;
    const channel = row.channel || "other";
    bucket[channel] = ((bucket[channel] as number) ?? 0) + row.count;
  }
  return Array.from(buckets.values());
}

/** Row-fetch fallback for when the RPC isn't available. Same output shape. */
async function getDashboardDataFallback(
  admin: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<DashboardData> {
  const [
    totals,
    prevTotals,
    viewsSeries,
    sharesByChannel,
    topSources,
    topLinks,
    channelConversion,
    visitorStats,
    geoCountries,
    geoCities,
  ] = await Promise.all([
    getTotals(admin, ownerId, days, cardId),
    getTotals(admin, ownerId, days, cardId, 1),
    getDailySeries(admin, ownerId, "profile_view", days, cardId),
    getDailySharesByChannel(admin, ownerId, days, cardId),
    getTopSources(admin, ownerId, days, cardId),
    getTopLinks(admin, ownerId, days, cardId),
    getChannelConversion(admin, ownerId, days, cardId),
    getVisitorStats(admin, ownerId, days, cardId),
    getGeoDistribution(admin, ownerId, "country", days, cardId),
    getGeoDistribution(admin, ownerId, "city", days, cardId),
  ]);

  return {
    totals: totals ?? EMPTY_TOTALS,
    prevTotals: prevTotals ?? EMPTY_TOTALS,
    viewsSeries,
    sharesByChannel,
    topSources,
    topLinks,
    channelConversion,
    visitorStats,
    geoCountries,
    geoCities,
  };
}

// ---------------------------------------------------------------------------
// JS fallback aggregations (same semantics as the RPC; UTC day buckets)
// ---------------------------------------------------------------------------

/** Daily counts for a single event_type over the last N days (UTC, zero-filled). */
export async function getDailySeries(
  supabase: SupabaseClient,
  ownerId: string,
  eventType: string,
  days: number,
  cardId?: string | null
): Promise<DayPoint[]> {
  try {
    const from = windowStartUtc(days);

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

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      buckets.set(
        new Date(from.getTime() + i * MS_PER_DAY).toISOString().slice(0, 10),
        0
      );
    }
    for (const row of data) {
      // PostgREST returns timestamptz as ISO with +00:00 → slicing gives UTC date.
      const key = String(row.created_at).slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets, ([date, count]) => ({ date, count }));
  } catch {
    return [];
  }
}

/** Daily share counts broken down by channel (zero-filled, UTC). */
export async function getDailySharesByChannel(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<ChannelPoint[]> {
  try {
    const from = windowStartUtc(days);

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
      const key = new Date(from.getTime() + i * MS_PER_DAY)
        .toISOString()
        .slice(0, 10);
      buckets.set(key, { date: key });
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

/** Top traffic sources (from profile_view events) over the window. */
export async function getTopSources(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<SourcePoint[]> {
  try {
    const from = windowStartUtc(days);

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

/** Top clicked social links (link_click events by platform) over the window. */
export async function getTopLinks(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<LinkPoint[]> {
  try {
    const from = windowStartUtc(days);

    let query = supabase
      .from("analytics_events")
      .select("channel")
      .eq("owner_id", ownerId)
      .eq("event_type", "link_click")
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return [];

    const counts = new Map<string, number>();
    for (const row of data) {
      const link = (row.channel as string) || "other";
      counts.set(link, (counts.get(link) ?? 0) + 1);
    }
    return Array.from(counts, ([link, count]) => ({ link, count })).sort(
      (a, b) => b.count - a.count
    );
  } catch {
    return [];
  }
}

/**
 * Conversion by share channel: shares per channel vs profile views attributed
 * to that channel. Real attribution: every shared URL carries ?src=<channel>,
 * and parseSource() stores it on the resulting view.
 */
export async function getChannelConversion(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<ChannelConversion[]> {
  try {
    const from = windowStartUtc(days);

    const sharesQuery = supabase
      .from("analytics_events")
      .select("channel")
      .eq("owner_id", ownerId)
      .eq("event_type", "share")
      .gte("created_at", from.toISOString());

    const viewsQuery = supabase
      .from("analytics_events")
      .select("source")
      .eq("owner_id", ownerId)
      .eq("event_type", "profile_view")
      .gte("created_at", from.toISOString());

    const [sharesRes, viewsRes] = await Promise.all([
      cardId ? sharesQuery.eq("card_id", cardId) : sharesQuery,
      cardId ? viewsQuery.eq("card_id", cardId) : viewsQuery,
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

/**
 * Unique vs returning visitors over the window.
 *   unique    = distinct visitor_id (cookieless rows are excluded — a null id
 *               is NOT lumped into one fake "anon" visitor anymore)
 *   returning = visitors with more than one distinct 30-minute session
 */
export async function getVisitorStats(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null
): Promise<VisitorStats> {
  try {
    const from = windowStartUtc(days);

    let query = supabase
      .from("analytics_events")
      .select("visitor_id, session_id")
      .eq("owner_id", ownerId)
      .eq("event_type", "profile_view")
      .gte("created_at", from.toISOString());

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return { unique: 0, returning: 0 };

    const sessionsByVisitor = new Map<string, Set<string>>();
    for (const row of data) {
      const id = row.visitor_id as string | null;
      if (!id) continue; // cookieless — not attributable to a visitor
      const sid = (row.session_id as string | null) ?? "nosession";
      let set = sessionsByVisitor.get(id);
      if (!set) {
        set = new Set<string>();
        sessionsByVisitor.set(id, set);
      }
      set.add(sid);
    }

    let unique = 0;
    let returning = 0;
    for (const sessions of sessionsByVisitor.values()) {
      unique += 1;
      if (sessions.size > 1) returning += 1;
    }
    return { unique, returning };
  } catch {
    return { unique: 0, returning: 0 };
  }
}

/** Top countries (or cities) by profile views over the window. */
export async function getGeoDistribution(
  supabase: SupabaseClient,
  ownerId: string,
  field: "country" | "city",
  days: number,
  cardId?: string | null
): Promise<GeoPoint[]> {
  try {
    const from = windowStartUtc(days);

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

/**
 * Headline totals over the window (stat cards). `offsetWindows = 1` returns
 * the previous window of the same length (for period-over-period deltas).
 * QR scans are derived from profile_view rows with source='qr' — never a
 * separate event — so QR traffic is never double-counted.
 */
export async function getTotals(
  supabase: SupabaseClient,
  ownerId: string,
  days: number,
  cardId?: string | null,
  offsetWindows = 0
): Promise<Totals> {
  try {
    const from = windowStartUtc(days, offsetWindows);

    let query = supabase
      .from("analytics_events")
      .select("event_type, source")
      .eq("owner_id", ownerId)
      .gte("created_at", from.toISOString());

    if (offsetWindows > 0) {
      const to = windowStartUtc(days, offsetWindows - 1);
      query = query.lt("created_at", to.toISOString());
    }
    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error || !data) return { ...EMPTY_TOTALS };

    const totals: Totals = { ...EMPTY_TOTALS };
    for (const row of data) {
      switch (row.event_type) {
        case "profile_view":
          totals.views += 1;
          if ((row.source as string | null) === "qr") totals.qrScans += 1;
          break;
        case "share":
          totals.shares += 1;
          break;
        case "vcard_download":
          totals.vcardDownloads += 1;
          break;
        case "link_click":
          totals.linkClicks += 1;
          break;
        case "konneqt":
          totals.konneqts += 1;
          break;
      }
    }
    return totals;
  } catch {
    return { ...EMPTY_TOTALS };
  }
}
