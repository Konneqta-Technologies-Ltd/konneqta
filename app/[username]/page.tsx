import { canUseBanners, canUseThemes } from "@/lib/entitlements";

import  Link  from "next/link"
import type { Metadata } from "next";
import ProfileCard from "@/components/ProfileCard";
import type { ThemeCustomization } from "@/lib/themes";
import { createClient } from "@/lib/supabase/server";
import { isAllowedStorageUrl } from "@/lib/url-validation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  // Look up only the public fields needed for the preview card.
  // Queries cards by slug (the URL segment) — not profiles.
  const { data: card } = await supabase
    .from("cards")
    .select("full_name, job_title, company, avatar_url")
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
  const description =
    jobTitle && company
      ? `${jobTitle} at ${company}`
      : jobTitle || company || `Connect with @${username} on Konneqta`;

  const avatarUrl = card.avatar_url?.trim() || "";
  const ogImage =
    avatarUrl && isAllowedStorageUrl(avatarUrl) ? avatarUrl : "/banner.png";

  return {
    title: `${fullName} · Konneqta`,
    description,
    alternates: { canonical: `/${username}` },
    openGraph: {
      title: `${fullName} · Konneqta`,
      description,
      url: `/${username}`,
      siteName: "Konneqta",
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullName }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${fullName} · Konneqta`,
      description,
      images: [ogImage],
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
      "id, owner_id, slug, full_name, job_title, company, bio, avatar_url, logo_url, qr_code_url, theme, banner_url"
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
  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("id, username, plan, is_exempt")
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


  // Check if the current visitor is the owner
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && user.id === card.owner_id);

  // Build the profile object that ProfileCard expects.
  // Map card fields → the Profile shape ProfileCard already uses.
  // theme_custom may be null (no customizations) — resolveTheme() handles
  // that by falling back to the preset colors.
  const profile = {
    id: card.owner_id,
    username: card.slug,
    full_name: card.full_name,
    job_title: card.job_title,
    company: card.company,
    bio: card.bio,
    avatar_url: card.avatar_url,
    logo_url: card.logo_url,
    qr_code_url: card.qr_code_url,
    theme: card.theme,
    banner_url: card.banner_url,
    theme_custom: themeCustom,
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <ProfileCard
        profile={profile}
        socialLinks={socialLinks ?? []}
        isOwner={isOwner}
        canUseThemes={canUseThemes(owner)}
        canUseBanners={canUseBanners(owner)}
      />
    </main>
  );
}