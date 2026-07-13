import type { MetadataRoute } from "next";

import { createClient } from "@/lib/supabase/server";

/**
 * Sitemap — enumerates every indexable URL on konneqta.com.
 *
 * Static routes (landing, waitlist) are hardcoded. Public profile pages
 * (`/{username}`) are built dynamically from the `cards` table.
 *
 * Only primary, searchable cards are included:
 * - Non-primary (Pro-only) cards redirect to the owner's primary card for
 *   non-Pro visitors, so listing them would create redirect chains.
 * - Cards with `is_searchable = false` are opted out of search engines.
 *
 * `lastModified` uses each card's `updated_at` (auto-maintained by the
 * `cards_updated_at` trigger) so Google knows exactly which profile changed.
 *
 * Requires migration: supabase/add-updated-at-and-searchable.sql
 *
 * Routes disallowed in `app/robots.ts` (auth, onboarding, /api, etc.) are
 * intentionally NOT listed here — a URL in the sitemap should be indexable.
 */

// Revalidate every hour so newly created profiles appear without a full redeploy.
export const revalidate = 3600;

// Production origin, with a safe fallback. Never localhost (the previous default
// leaked a dev URL into the generated sitemap on production builds).
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.konneqta.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static, indexable pages ────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/home`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/waitlist`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // ── Dynamic public profile pages ───────────────────────────────────────
  // Fetch slug + updated_at for primary, searchable cards. `updated_at` gives
  // Google the real modification time; `is_searchable` lets a card opt out of
  // search engines. Requires the add-updated-at-and-searchable.sql migration.
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("slug, updated_at")
    .eq("is_primary", true)
    .eq("is_searchable", true)
    .order("slug", { ascending: true });

  const profileRoutes: MetadataRoute.Sitemap = (cards ?? [])
    .filter(
      (c): c is { slug: string; updated_at: string | null } => Boolean(c?.slug),
    )
    .map((card) => ({
      url: `${baseUrl}/${card.slug}`,
      lastModified: card.updated_at ? new Date(card.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [...staticRoutes, ...profileRoutes];
}