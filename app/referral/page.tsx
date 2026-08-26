import GoBackButton from "@/components/GoBackButton";
import ReferralPanel, {
  type ReferralEntry,
} from "@/components/referrals/ReferralPanel";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refer & Earn · Konneqta",
  description: "Share your referral code and earn free Premium days.",
  robots: { index: false, follow: false },
};

/**
 * Referral page (auth-gated).
 *
 * Shows the user's unique referral code + share link, a brief explainer of
 * how rewards work, their referral stats, and — for free users who signed up
 * before this feature — a form to attach someone else's code (still subject
 * to the "before your first payment" rule, enforced server-side).
 *
 * Codes are generated + locked at the DB layer (supabase/referrals-setup.sql)
 * — this page only reads them.
 */
export default async function ReferralPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Owner's code + entitlements (for the Premium-expiry display).
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, plan, is_exempt, pro_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  // Stats + list: referrals where THIS user is the referrer. The embedded
  // join resolves each referred account's username (public data — same rows
  // the public card page reads). Explicit FK hint so PostgREST returns an
  // object, not an array.
  const { data: referralRows } = await supabase
    .from("referrals")
    .select(
      "status, reward_days, rewarded_at, created_at, referred:profiles!referrals_referred_id_fkey(username)"
    )
    .eq("referrer_id", user.id);

  const rows = referralRows ?? [];
  const joinedCount = rows.filter((r) => r.status === "signed_up").length;
  const rewardedCount = rows.filter((r) => r.status === "rewarded").length;
  const daysEarned = rows.reduce((sum, r) => sum + (r.reward_days ?? 0), 0);

  // Referral list for the panel: usernames + status, subscribed first
  // (newest reward), then joined (newest signup). Null usernames are
  // skipped defensively — cascade deletes make them impossible in practice.
  type RawReferred = { username?: string | null } | null;
  const referralList = rows
    .map((r) => {
      const referred = (Array.isArray(r.referred)
        ? r.referred[0]
        : r.referred) as RawReferred;
      return {
        username: referred?.username ?? null,
        status: r.status as "signed_up" | "rewarded" | "revoked",
        rewardDays: r.reward_days ?? 0,
        rewardedAt: r.rewarded_at ?? null,
        createdAt: r.created_at ?? null,
      };
    })
    .filter((r): r is ReferralEntry => r.username !== null)
    .sort((a, b) => {
      // Rewarded rows first…
      if (a.status === "rewarded" && b.status !== "rewarded") return -1;
      if (b.status === "rewarded" && a.status !== "rewarded") return 1;
      // …then newest activity within each group.
      const aTime = new Date(a.rewardedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.rewardedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

  // Can this account still attach someone else's code? (RLS: own rows only.)
  const [{ data: asReferred }, { count: paidCount }] = await Promise.all([
    supabase
      .from("referrals")
      .select("id")
      .eq("referred_id", user.id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .eq("status", "successful"),
  ]);

  const canEnterCode = !asReferred && (paidCount ?? 0) === 0;

  // Canonical origin for the shareable link (same env var the QR uses).
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  return (
    <main className="min-h-screen bg-zinc-50 px-4 pt-20 pb-8 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Refer &amp; Earn
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Free Premium for every friend who subscribes
            </p>
          </div>
          <GoBackButton />
        </div>

        <ReferralPanel
          referralCode={profile?.referral_code ?? null}
          origin={origin}
          plan={profile?.plan ?? "free"}
          isExempt={profile?.is_exempt ?? false}
          proExpiresAt={profile?.pro_expires_at ?? null}
          joinedCount={joinedCount}
          rewardedCount={rewardedCount}
          daysEarned={daysEarned}
          canEnterCode={canEnterCode}
          referrals={referralList}
        />
      </div>
    </main>
  );
}
