import GoBackButton from "@/components/GoBackButton";
import NotificationList from "@/components/notifications/NotificationList";
import type { AppNotification } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications · Konneqta",
  description: "Your Konneqta notifications.",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 30;

/** 90-day retention cutoff (helper keeps Date.now out of the render path). */
function ninetyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString();
}

/**
 * /notifications — full notification history (the sidenav dropdown shows the
 * 10 latest; this page is reachable via its "See more" link and push taps).
 *
 * NOT listed in the sidenav by design — the bell covers it.
 *
 * Also performs the 90-day retention cleanup for the visiting user (see
 * supabase/notifications-setup.sql §5, Option B): rows older than 90 days
 * are deleted (RLS-scoped to the caller) before the first page is read.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Lazy 90-day cleanup (fire-and-forget style — failures just skip pruning).
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .lt("created_at", ninetyDaysAgoIso());

  // First page + hasMore flag (fetch one extra row).
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const items = (rows ?? []).slice(0, PAGE_SIZE) as AppNotification[];
  const hasMore = (rows?.length ?? 0) > PAGE_SIZE;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 pt-20 pb-8 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Notifications
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your latest activity
            </p>
          </div>
          <GoBackButton />
        </div>

        {/* key = newest item id — when the server data changes (e.g. after
            router.refresh), the list remounts with fresh initial state. */}
        <NotificationList
          key={items[0]?.id ?? "empty"}
          initialItems={items}
          initialHasMore={hasMore}
        />
      </div>
    </main>
  );
}
