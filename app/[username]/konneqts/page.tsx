import GoBackButton from "@/components/GoBackButton";
import type { KonneqtCardData } from "@/components/konneqts/KonneqtCard";
import KonneqtsGrid from "@/components/konneqts/KonneqtsGrid";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMaxVisibleKonneqts } from "@/lib/entitlements";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Konneqts · Konneqta",
  description: "Your connections on Konneqta.",
  robots: { index: false, follow: false },
};

/**
 * Konneqts page — shows connections for a specific user.
 *
 * Pulls from BOTH tables and merges them into a single chronological list:
 *   - `konneqts`       → user-to-user relationships (bidirectional: I'm a OR b)
 *   - `guest_konneqts` → anonymous submissions received
 *
 * For user connections, the "other" user's active card slug is resolved at
 * read time (via profiles.active_card_id → cards.slug) so the card always
 * links to their latest profile. This makes the page a living network, not a
 * static address book.
 *
 * DISPLAY LIMIT: free users see their N most recent (default 10); pro users
 * see all. The total count is computed separately so we can render the
 * "🔒 N more · Upgrade" footer. Connections are NEVER blocked from being
 * stored — the limit is purely visual.
 */
export default async function KonneqtsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // --- AUTH GATE + OWNERSHIP CHECK -----------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated - redirect to login
    redirect("/auth/login");
  }

  const myId = user.id;

  // Look up the owner of this profile to get their profile info
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, plan, is_exempt, pro_expires_at, status")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Profile not found.
        </p>
      </div>
    );
  }

  // Check if the authenticated user is the profile owner
  if (profile.id !== myId) {
    // Not the owner - redirect to the owner's own konneqts page (which will fail auth)
    redirect(`/${profile.username}/konneqts`);
  }

  // Deactivated profiles cannot have visible connections
  if (profile.status === "deactivated") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This profile is not active.
        </p>
      </div>
    );
  }

  // Fetch connections for this user (where they are user_a OR user_b)
  const { data: userRows } = await supabase
    .from("konneqts")
    .select("id, user_a, user_b, connected_at")
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)
    .order("connected_at", { ascending: false });

  // Fetch guest submissions (where they received them)
  const { data: guestRows } = await supabase
    .from("guest_konneqts")
    .select("id, guest_name, guest_phone, message, connected_at")
    .eq("owner_id", myId)
    .order("connected_at", { ascending: false });

  // Resolve "other" user profiles + active card slugs
  const otherUserIds = (userRows ?? [])
    .map((r) => (r.user_a === myId ? r.user_b : r.user_a))
    .filter(Boolean);

  const otherProfilesMap = new Map<
    string,
    {
      username: string | null;
      slug: string | null;
      full_name: string | null;
      job_title: string | null;
      company: string | null;
      avatar_url: string | null;
      active_card_id: string | null;
    }
  >();

  if (otherUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, status, active_card_id")
      .in("id", otherUserIds);

    const activeProfiles = (profiles ?? []).filter(
      (p) => p.status !== "deactivated"
    );
    const cardIds = activeProfiles
      .map((p) => p.active_card_id)
      .filter(Boolean) as string[];

    const { data: cards } = cardIds.length
      ? await supabase
          .from("cards")
          .select("id, slug, full_name, job_title, company, avatar_url")
          .in("id", cardIds)
      : { data: [] };

    const cardMap = new Map<string, NonNullable<typeof cards>[number]>();
    for (const c of cards ?? []) {
      cardMap.set(c.id, c);
    }

    for (const p of activeProfiles) {
      const card = p.active_card_id ? cardMap.get(p.active_card_id) : undefined;
      otherProfilesMap.set(p.id, {
        username: p.username,
        slug: card?.slug ?? p.username,
        full_name: card?.full_name ?? null,
        job_title: card?.job_title ?? null,
        company: card?.company ?? null,
        avatar_url: card?.avatar_url ?? null,
        active_card_id: p.active_card_id,
      });
    }
  }

  // Build the merged feed
  const allItems: KonneqtCardData[] = [];

  for (const r of userRows ?? []) {
    const otherId = r.user_a === myId ? r.user_b : r.user_a;
    const p = otherProfilesMap.get(otherId);
    if (!p) continue;
    allItems.push({
      id: r.id,
      type: "user",
      displayName: p.full_name || p.username || "Konneqta user",
      slug: p.slug ?? p.username,
      jobTitle: p.job_title,
      company: p.company,
      avatarUrl: p.avatar_url,
      createdAt: r.connected_at,
    });
  }

  for (const g of guestRows ?? []) {
    allItems.push({
      id: g.id,
      type: "guest",
      displayName: g.guest_name,
      note: g.message,
      phone: g.guest_phone,
      createdAt: g.connected_at,
    });
  }

  // Sort by created_at descending
  allItems.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Apply display limit
  const limit = getMaxVisibleKonneqts(profile);
  const totalCount = allItems.length;
  const visibleItems =
    limit === Infinity ? allItems : allItems.slice(0, limit);
  const hiddenCount = Math.max(0, totalCount - visibleItems.length);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 pt-20 pb-8 dark:bg-black">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {`${profile.username}'s Konneqts`}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalCount} {totalCount === 1 ? "connection" : "connections"}
            </p>
          </div>
          <GoBackButton />
        </div>

        <KonneqtsGrid items={visibleItems} hiddenCount={hiddenCount} />
      </div>
    </main>
  );
}