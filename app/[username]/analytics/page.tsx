import {
  ConversionChart,
  FunnelChart,
  GeoChart,
  SharesByChannelChart,
  SourcesChart,
  TopLinksChart,
  TotalsRow,
  ViewsChart,
  VisitorsChart,
} from '@/components/analytics/Charts';
import { getDashboardData } from '@/lib/analytics/queries';
import { notFound, redirect } from 'next/navigation';

import GoBackButton from '@/components/GoBackButton';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/analytics/server';
import { isPro } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

const ALLOWED_RANGES = [7, 30, 90] as const;
const DEFAULT_RANGE = 30;

/**
 * Analytics dashboard — Pro-only.
 *
 * Shows the owner all tracked metrics for their cards with charts: views,
 * QR scans, shares, vCard saves, LINK CLICKS, konneqts, traffic sources,
 * conversion by channel, unique/returning visitors, geographic distribution,
 * a view→save→konneqt funnel, and period-over-period deltas.
 *
 * Filters (URL-driven, so views are shareable):
 *   ?range=7|30|90  — window length in days
 *   ?card=<uuid>    — limit to one card (Pro users have up to 3)
 *
 * Counting rules (v2 — enforced at write time, see docs/analytics-plan.md):
 *   the owner's own views/clicks/downloads and known bots are never recorded;
 *   views are de-duplicated per visitor per 30-minute session.
 *
 * Access control:
 *   1. Must be signed in.
 *   2. Must be Pro (or exempt). Free users get an upgrade prompt.
 *   3. Must own the card whose slug matches the URL segment.
 */
export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ range?: string; card?: string }>;
}) {
  const { username } = await params;
  const { range: rangeParam, card: cardParam } = await searchParams;
  const supabase = await createClient();

  // --- Auth + ownership -------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Resolve the owner's primary card by slug (must be owned by the caller).
  const { data: card } = await supabase
    .from('cards')
    .select('id, owner_id, slug')
    .eq('slug', username)
    .maybeSingle();

  if (!card || card.owner_id !== user.id) {
    notFound();
  }

  // --- Entitlements gate (Pro-only) -------------------------------------
  const { data: owner } = await supabase
    .from('profiles')
    .select('id, username, plan, is_exempt, pro_expires_at')
    .eq('id', card.owner_id)
    .maybeSingle();

  const ownerIsPro = isPro(owner);

  if (!ownerIsPro) {
    // Free users get an upgrade screen, not a hard 404 — they should know the
    // feature exists once they upgrade.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--main-orange)/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Analytics is a Pro feature
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Upgrade to Pro to see your profile views, shares, QR scans, link
            clicks, traffic sources, visitors, and geographic insights.
          </p>
          <Link
            href={`/${username}`}
            className="mt-5 inline-block rounded-lg bg-(--main-orange) px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Upgrade to Pro
          </Link>
          <div className="mt-4">
            <GoBackButton />
          </div>
        </div>
      </main>
    );
  }

  // --- Range + card filter (URL-driven) ----------------------------------
  const parsedRange = Number.parseInt(rangeParam ?? '', 10);
  const days: number = (ALLOWED_RANGES as readonly number[]).includes(
    parsedRange,
  )
    ? parsedRange
    : DEFAULT_RANGE;

  // The owner's cards — powers the per-card filter chips (Pro has up to 3).
  const { data: ownerCards } = await supabase
    .from('cards')
    .select('id, slug, is_primary')
    .eq('owner_id', card.owner_id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  const cards = ownerCards ?? [];
  const selectedCardId =
    cardParam && cards.some((c) => c.id === cardParam) ? cardParam : null;

  // --- Fetch dashboard data (one RPC round-trip; JS fallback inside) -----
  const admin = getAdminClient();
  const ownerId = card.owner_id;
  const data = await getDashboardData(admin, ownerId, days, selectedCardId);

  // Build filter links that keep the other filter intact.
  const filterHref = (over: { range?: number; card?: string | null }) => {
    const params = new URLSearchParams();
    params.set('range', String(over.range ?? days));
    const c = 'card' in over ? over.card : selectedCardId;
    if (c) params.set('card', c);
    const qs = params.toString();
    return `/${username}/analytics${qs ? '?' + qs : ''}`;
  };

  const tabActive =
    'rounded-lg bg-(--main-orange) px-3 py-1.5 text-xs font-semibold text-white';
  const tabIdle =
    'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700';

  return (
    <main
      className="min-h-screen pt-20 bg-zinc-50 px-4 py-8 dark:bg-black"
      data-tour="analytics"
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Analytics
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              @{username} · last {days} days
            </p>
          </div>
          <GoBackButton />
        </div>

        {/* Filters: range tabs + per-card chips */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {ALLOWED_RANGES.map((r) => (
            <Link
              key={r}
              href={filterHref({ range: r })}
              className={r === days ? tabActive : tabIdle}
            >
              {r} days
            </Link>
          ))}
          {cards.length > 1 && (
            <>
              <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
              <Link
                href={filterHref({ card: null })}
                className={!selectedCardId ? tabActive : tabIdle}
              >
                All cards
              </Link>
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={filterHref({ card: c.id })}
                  className={selectedCardId === c.id ? tabActive : tabIdle}
                >
                  {c.slug}
                </Link>
              ))}
            </>
          )}
        </div>

        {/* Totals with prev-period deltas */}
        <div className="mb-6">
          <TotalsRow totals={data.totals} prevTotals={data.prevTotals} />
        </div>

        {/* Funnel: views → save contact → konneqt */}
        <div className="mb-6">
          <FunnelChart
            data={[
              { label: 'Profile views', count: data.totals.views },
              { label: 'vCard saves', count: data.totals.vcardDownloads },
              { label: 'Konneqts', count: data.totals.konneqts },
            ]}
          />
        </div>

        {/* Views + Visitors */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <ViewsChart data={data.viewsSeries} />
          <VisitorsChart data={data.visitorStats} />
        </div>

        {/* Shares by channel + Sources */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <SharesByChannelChart data={data.sharesByChannel} />
          <SourcesChart data={data.topSources} />
        </div>

        {/* Top links + Conversion */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <TopLinksChart data={data.topLinks} />
          <ConversionChart data={data.channelConversion} />
        </div>

        {/* Geo */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GeoChart data={data.geoCountries} label="By country" />
          <GeoChart data={data.geoCities} label="By city" />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
          All times are UTC. Your own views, clicks and known bots are excluded.
          Views are de-duplicated per visitor per 30-minute session. Data
          updates on each visit.
        </p>
      </div>
    </main>
  );
}
