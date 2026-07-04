import { canUseBanners, canUseThemes } from "@/lib/entitlements";

import type { Metadata } from "next";
import ProfileCard from "@/components/ProfileCard";
import { createClient } from "@/lib/supabase/server";
import { isAllowedStorageUrl } from "@/lib/url-validation";
import { redirect } from "next/navigation";

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

  // Look up the card by slug. Explicit column list — never "*".
  // phone / email / show_phone are NOT in cards (they stay account-level
  // on profiles), so they can never leak to the public page.
  const { data: card } = await supabase
    .from("cards")
    .select(
      "id, owner_id, slug, full_name, job_title, company, bio, avatar_url, logo_url, qr_code_url, theme, banner_url"
    )
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    redirect("/");
  }

  // Fetch the social links for this card
  const { data: socialLinks } = await supabase
    .from("social_links")
    .select("platform, url")
    .eq("card_id", card.id)
    .order("created_at", { ascending: true });

  // Fetch the owner's entitlements (for feature gating + owner check)
  const { data: owner } = await supabase
    .from("profiles")
    .select("id, plan, is_exempt")
    .eq("id", card.owner_id)
    .maybeSingle();

  // Check if the current visitor is the owner
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && user.id === card.owner_id);

  // Build the profile object that ProfileCard expects.
  // Map card fields → the Profile shape ProfileCard already uses.
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