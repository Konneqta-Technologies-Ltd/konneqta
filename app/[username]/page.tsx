import { canUseBanners, canUseThemes, isPro } from "@/lib/entitlements";

import Link from "next/link";
import type { Metadata } from "next";
import OwnerBadges from "@/components/OwnerBadges";
import ProfileCard from "@/components/ProfileCard";
import type { ThemeCustomization } from "@/lib/themes";
import { buildPersonSchema } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getVisitorId } from "@/lib/analytics/visitor";
import { headers } from "next/headers";
import { parseGeo } from "@/lib/analytics/geo";
import { parseSource } from "@/lib/analytics/source";
import { recordEvent } from "@/lib/analytics/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  // Look up only the public fields needed for the preview card.
  // Queries cards by slug (the URL segment) — not profiles. Includes `bio`
  // so we can build a richer, SEO-length description (110–160 chars).
  const { data: card } = await supabase
    .from("cards")
    .select("full_name, job_title, company, bio, avatar_url, is_searchable")
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    return {
      title: `${username} · Konneqta`,
      description: `Connect with @${username} on Konneqta`,
    };
  }

  const fullName = card.full_name?.trim() || username;
  const jobTitle = card.job_title?.trim() || "";
  const company = card.company?.trim() || "";
  const bio = card.bio?.trim() || "";

  // Pipe-separated title: "FullName | JobTitle | Company | Konneqta".
  // De-dupe with a Set so a company literally named "Konneqta" can't produce
  // "... | Konneqta | Konneqta".
  const title = [...new Set([fullName, jobTitle, company, "Konneqta"].filter(Boolean))].join(" | ");

  // Richer description targeting the 110–160 char SEO sweet spot. Prefers the
  // user's bio; otherwise builds an informative, keyword-rich fallback that
  // reads naturally for search snippets and social previews. Hard-capped at
  // 155 chars so Google won't truncate mid-word.
  const role = [jobTitle, company].filter(Boolean).join(" at ");
  const description = (
    bio
      ? `${fullName}${role ? ` — ${role}. ` : ": "}${bio}`
      : `Connect with ${fullName}${role ? ` (${role})` : ""} on Konneqta — their digital business card with all social links in one place.`
  ).slice(0, 155);

  const imageUrl = `https://www.konneqta.com/${username}/opengraph-image`;

  // og:image is generated dynamically by app/[username]/opengraph-image.tsx
  // (Next.js file convention) AND declared explicitly here so we control the
  // exact width/height/alt. Strict crawlers (WhatsApp, LinkedIn) require the
  // declared dimensions to match the actual served image.
  return {
    title,
    description,
    alternates: { canonical: `/${username}` },
    // Per-card opt-out from search engines (is_searchable column).
    ...(card.is_searchable === false
      ? { robots: { index: false, follow: false } }
      : {}),
    authors: [{ name: fullName }],
    creator: fullName,
    publisher: "Konneqta",
    openGraph: {
      title,
      description,
      url: `https://www.konneqta.com/${username}`,
      siteName: "Konneqta",
      // og:locale helps platforms localize the audience targeting.
      locale: "en_US",
      type: "profile",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 1500,
          alt: `${fullName} on Konneqta`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // Explicit image so Next.js metadata merging doesn't bleed the root
      // layout's generic "/banner.png" into profile Twitter cards.
      images: [imageUrl],
      // twitter:site attributes the card to the brand account.
      site: "@konneqta",
    },
  };
}

export default async function UsernamePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // ── PRIMARY CARD LOOKUP ──────────────────────────────────────────────
  // Query ONLY columns that are guaranteed to exist on `cards`. This is the
  // critical fix: the previous query selected `theme_custom`, a column that
  // was NEVER created on `cards`. PostgREST responds to an unknown column
  // with a schema-cache error (PGRST107) and returns `data: null` — so even
  // though the card row existed, the page showed "Profile not found."
  // That was the root cause of the second-login failure.
  //
  // `theme_custom` is fetched SEPARATELY (below) so a missing column can
  // never break the whole page. Run `supabase/add-theme-custom-to-cards.sql`
  // to enable custom themes; until then this still renders correctly.
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select(
      "id, owner_id, slug, is_primary, full_name, job_title, company, bio, avatar_url, logo_url, qr_code_url, theme, banner_url"
    )
    .eq("slug", username)
    .maybeSingle();

  if (cardError) {
    console.error("[username] card query error:", cardError.message);
  }

  if (cardError || !card) {
     return (
    <div className="flex h-screen flex-col items-center justify-center">
      <p>Profile not found.</p>
      <Link href="/" className="mt-4 text-blue-600 underline">
        Go Home
      </Link>
    </div>
  );
  }

  // ── OPTIONAL: custom theme overrides ─────────────────────────────────
  // Fetched separately so a missing `theme_custom` column (pre-migration)
  // cannot null out the card data above. Errors here are non-fatal — we
  // just fall back to the preset theme.
  let themeCustom: ThemeCustomization | null = null;
  const { data: customRow, error: customErr } = await supabase
    .from("cards")
    .select("theme_custom")
    .eq("id", card.id)
    .maybeSingle();
  if (customErr) {
    // Expected if the migration hasn't been run yet — safe to ignore.
    console.warn("[username] theme_custom unavailable (run add-theme-custom-to-cards.sql):", customErr.message);
  } else if (customRow?.theme_custom) {
    themeCustom = customRow.theme_custom as ThemeCustomization;
  }

  // Fetch the social links for this card
  const { data: socialLinks } = await supabase
    .from("social_links")
    .select("platform, url")
    .eq("card_id", card.id)
    .order("created_at", { ascending: true });

  // Fetch the owner's entitlements (for feature gating + owner check).
  // `username` is required so isExempt() can match EXEMPT_USERNAMES.
  // `pro_expires_at` is required so isPro() can enforce subscription expiry.
  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("id, username, plan, is_exempt, pro_expires_at")
    .eq("id", card.owner_id)
    .maybeSingle();

    if(ownerError || !owner) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p>Profile owner could not be verified.</p>
        <Link href="/" className="mt-4 text-blue-600 underline">
          Go Home
        </Link>

      </div>
    )
    }


  // ── SUBSCRIPTION EXPIRY: read-time feature reversion ─────────────────
  // If the owner's Pro has expired (or they're on free tier), Pro-only
  // features gracefully revert to free defaults. The data stays in the DB;
  // we just override what's rendered. If they renew, everything comes back.
  const ownerIsPro = isPro(owner);

  // Non-primary cards (card #2, #3) are Pro-only. If the owner is not Pro,
  // redirect visitors to the owner's primary card so QR scans / links don't
  // hit a dead end. The owner's primary slug = their username.
  if (!ownerIsPro && card.is_primary === false) {
    redirect(`/${owner.username}`);
  }

  // Check if the current visitor is the owner
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && user.id === card.owner_id);

  // Build the profile object that ProfileCard expects.
  // Map card fields → the Profile shape ProfileCard already uses.
  // theme_custom may be null (no customizations) — resolveTheme() handles
  // that by falling back to the preset colors.
  //
  // EXPIRY OVERRIDE: when the owner is not Pro, force free-tier rendering
  // (classic theme, no banner, no logo, no custom theme). The original
  // values remain safely in the DB for when they renew.
  const profile = {
    id: card.owner_id,
    cardId: card.id,
    username: card.slug,
    full_name: card.full_name,
    job_title: card.job_title,
    company: card.company,
    bio: card.bio,
    avatar_url: card.avatar_url,
    // Logo is Pro-only — hide when expired
    logo_url: ownerIsPro ? card.logo_url : null,
    qr_code_url: card.qr_code_url,
    // Force classic theme when not Pro
    theme: ownerIsPro ? card.theme : "classic",
    // Banner is Pro-only — hide when expired
    banner_url: ownerIsPro ? card.banner_url : null,
    // Custom theme overrides are Pro-only — discard when expired
    theme_custom: ownerIsPro ? themeCustom : null,
  };

  // ── ANALYTICS: profile view (fire-and-forget) ─────────────────────────
  // Record a view for the owner. We don't await this in a way that blocks the
  // response — recordEvent swallows all errors. Owner's own views are still
  // counted (useful for them to see their traffic), but we tag isOwner in a
  // way the dashboard could later filter. Note: the visitor cookie (`kq_vid`)
  // is set by the middleware (proxy.ts) — Server Components can only READ
  // cookies, not modify them. If the cookie is somehow absent (e.g. an edge
  // that bypassed the middleware), visitor_id is recorded as null, which
  // recordEvent handles gracefully (the column is nullable).
  //
  // Run after the redirect/404 guards so we never count dead-end hits.
  const visitorId = await getVisitorId();
  const headersList = await headers();
  const referer = headersList.get("referer");
  const geo = parseGeo((name) => headersList.get(name));
  const source = parseSource({ srcParam: null, referer });

  // Fire-and-forget — don't let a slow insert delay the render.
  void recordEvent({
    owner_id: card.owner_id,
    card_id: card.id,
    event_type: "profile_view",
    source,
    visitor_id: visitorId,
    country: geo.country,
    city: geo.city,
  });

  // ── SEO: schema.org Person JSON-LD ────────────────────────────────────
  // Tells Google this page represents a Person. Built from the card data we
  // already fetched above.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.konneqta.com";
  const personSchema = buildPersonSchema({
    username: card.slug,
    fullName: card.full_name,
    jobTitle: card.job_title,
    company: card.company,
    bio: card.bio,
    avatarUrl: card.avatar_url,
    socialLinks: socialLinks ?? [],
    baseUrl,
  });

  // OwnerBadges wraps the page content in a ShareCountProvider (for owners
  // only) and renders the top-right cluster (PlanBadge + ShareCounter +
  // UpgradeButton) side-by-side with no overlap. Nesting the content inside
  // it means the ShareMenu (within ProfileCard) shares the provider, so a
  // successful share ticks the counter down live, and a 429 from the server
  // can surface the "share limit reached" modal.
  return (
    <OwnerBadges isOwner={isOwner} isPro={ownerIsPro}>
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
        <ProfileCard
          profile={profile}
          socialLinks={socialLinks ?? []}
          isOwner={isOwner}
          canUseThemes={canUseThemes(owner)}
          canUseBanners={canUseBanners(owner)}
        />
      </main>
    </OwnerBadges>
  );
}