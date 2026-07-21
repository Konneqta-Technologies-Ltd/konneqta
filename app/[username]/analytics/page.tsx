import {
  ConversionChart,
  GeoChart,
  SharesByChannelChart,
  SourcesChart,
  TotalsRow,
  ViewsChart,
  VisitorsChart,
} from "@/components/analytics/Charts";
import {
  getChannelConversion,
  getDailySeries,
  getDailySharesByChannel,
  getGeoDistribution,
  getTopSources,
  getTotals,
  getVisitorStats,
} from "@/lib/analytics/queries";
import { notFound, redirect } from "next/navigation";

import GoBackButton from "@/components/GoBackButton";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/analytics/server";
import { isPro } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const RANGE_DAYS = 30;

/**
 * Analytics dashboard — Pro-only.
 *
 * Shows the owner all tracked metrics for their cards with charts:
 * views, shares, QR scans, vCard downloads, traffic sources, conversion by
 * channel, unique/returning visitors, and geographic distribution.
 *
 * Access control:
 *   1. Must be signed in.
 *   2. Must be Pro (or exempt). Free users are redirected to an upgrade prompt.
 *   3. Must own at least one card whose slug matches the URL segment.
 */
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // --- Auth + ownership -------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Resolve the owner's primary card by slug (must be owned by the caller).
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug")
    .eq("slug", username)
    .maybeSingle();

  if (!card || card.owner_id !== user.id) {
    notFound();
  }

  // --- Entitlements gate (Pro-only) -------------------------------------
  const { data: owner } = await supabase
    .from("profiles")
    .select("id, username, plan, is_exempt, pro_expires_at")
    .eq("id", card.owner_id)
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
            Upgrade to Pro to see your profile views, shares, QR scans, traffic
            sources, visitors, and geographic insights.
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

  // --- Fetch dashboard data (service-role, bypass RLS) ------------------
  const admin = getAdminClient();
  const ownerId = card.owner_id;
  const days = RANGE_DAYS;

  const [
    totals,
    viewsSeries,
    sharesByChannel,
    topSources,
    channelConversion,
    visitorStats,
    geoCountries,
    geoCities,
  ] = await Promise.all([
    getTotals(admin, ownerId, days),
    getDailySeries(admin, ownerId, "profile_view", days),
    getDailySharesByChannel(admin, ownerId, days),
    getTopSources(admin, ownerId, days),
    getChannelConversion(admin, ownerId, days),
    getVisitorStats(admin, ownerId, days),
    getGeoDistribution(admin, ownerId, "country", days),
    getGeoDistribution(admin, ownerId, "city", days),
  ]);

  return (
    <main className="min-h-screen pt-20 bg-zinc-50 px-4 py-8 dark:bg-black">
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

        {/* Totals */}
        <div className="mb-6">
          <TotalsRow totals={totals} />
        </div>

        {/* Views + Visitors */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <ViewsChart data={viewsSeries} />
          <VisitorsChart data={visitorStats} />
        </div>

        {/* Shares by channel + Sources */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <SharesByChannelChart data={sharesByChannel} />
          <SourcesChart data={topSources} />
        </div>

        {/* Conversion */}
        <div className="mb-6">
          <ConversionChart data={channelConversion} />
        </div>

        {/* Geo */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GeoChart data={geoCountries} label="By country" />
          <GeoChart data={geoCities} label="By city" />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-600">
          All times are server-local. Data updates on each visit.
        </p>
      </div>
    </main>
  );
}