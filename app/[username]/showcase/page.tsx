import GoBackButton from "@/components/GoBackButton";
import ShowcaseManager from "@/components/showcase/ShowcaseManager";
import { getMaxShowcaseItems } from "@/lib/entitlements";
import type { ShowcaseItem } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Showcase · Konneqta",
};

/**
 * Showcase management page — OWNER ONLY.
 *
 * The owner's catalogue of products & services. Everything visitors see is
 * read-only (the "Showcase · N items" trigger on the public card opens a
 * view-only modal); this page is where items are added, edited and deleted.
 *
 * Access control (mirrors app/[username]/analytics):
 *   1. Must be signed in.
 *   2. Must own the card whose slug matches the URL segment.
 *
 * The item cap shown here (free = 2, pro = 10, exempt = unlimited) is the
 * READ side from lib/entitlements — the DB limit trigger
 * (supabase/showcase-setup.sql) is the real gate.
 */
export default async function ShowcasePage({
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

  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug")
    .eq("slug", username)
    .maybeSingle();

  if (!card || card.owner_id !== user.id) {
    notFound();
  }

  // --- Entitlements: item cap by plan ------------------------------------
  const { data: owner } = await supabase
    .from("profiles")
    .select("username, plan, is_exempt, pro_expires_at")
    .eq("id", card.owner_id)
    .maybeSingle();

  const maxItems = getMaxShowcaseItems(owner);

  // --- Items (non-fatal: pre-migration the page still renders, empty) ----
  const { data: items, error: itemsError } = await supabase
    .from("showcase_items")
    .select("id, name, description, price, image_url, position, created_at")
    .eq("card_id", card.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsError) {
    // Expected when supabase/showcase-setup.sql hasn't been run yet.
    console.warn(
      "[showcase] items unavailable (run supabase/showcase-setup.sql):",
      itemsError.message,
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Showcase
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Curate your showcase to highlight your best products and services.
          </p>
        </div>
        <GoBackButton />
      </div>

      <div className="mt-8">
        <ShowcaseManager
          initialItems={(items ?? []) as ShowcaseItem[]}
          cardId={card.id}
          maxItems={maxItems}
        />
      </div>
    </main>
  );
}