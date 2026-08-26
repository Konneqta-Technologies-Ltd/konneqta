"use client";

/**
 * Refer & Earn panel — the interactive half of app/referral/page.tsx.
 *
 * - Shows the owner's referral code + link with copy / native-share buttons.
 * - Brief "how it works" (10 days per monthly sub, 90 per yearly, once per
 *   friend, stacks on remaining Premium days).
 * - Stats: friends joined / converted, Premium days earned, current expiry.
 * - "Have a referral code?" form for free users who signed up before the
 *   feature (attaches via the same audited /api/referrals/attach endpoint;
 *   every rule is re-checked server-side).
 */

import {
  MIN_REFERRAL_CODE_LENGTH,
  buildReferralLink,
  normalizeReferralCode,
} from "@/lib/referrals/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

/** One referred account, as resolved by the /referral page (usernames only). */
export type ReferralEntry = {
  username: string;
  status: "signed_up" | "rewarded" | "revoked";
  rewardDays: number;
  rewardedAt: string | null;
  createdAt: string | null;
};

export default function ReferralPanel({
  referralCode,
  origin,
  plan,
  isExempt,
  proExpiresAt,
  joinedCount,
  rewardedCount,
  daysEarned,
  canEnterCode,
  referrals = [],
}: {
  referralCode: string | null;
  /** Canonical site origin (NEXT_PUBLIC_SITE_URL); "" → window.location.origin. */
  origin: string;
  plan: "free" | "pro";
  isExempt: boolean;
  proExpiresAt: string | null;
  joinedCount: number;
  rewardedCount: number;
  daysEarned: number;
  canEnterCode: boolean;
  /** Referred accounts (usernames only), subscribed-first. */
  referrals?: ReferralEntry[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<"none" | "code" | "link">("none");
  const [codeInput, setCodeInput] = useState("");
  const [applying, setApplying] = useState(false);

  // Resolve the link origin: server-provided canonical origin, else current.
  const linkOrigin =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const shareLink = referralCode
    ? buildReferralLink(referralCode, linkOrigin)
    : "";

  const copy = async (text: string, what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(what);
    toast.success(what === "code" ? "Code copied!" : "Link copied!");
    setTimeout(() => setCopied("none"), 2000);
  };

  const handleShare = async () => {
    if (!shareLink) return;
    const text =
      "Create your digital identity card on Konneqta — and if you go Premium with my code, I earn free Premium days 🎉";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Konneqta", text, url: shareLink });
        return;
      } catch {
        // User dismissed the share sheet — fall through to copy.
      }
    }
    await copy(shareLink, "link");
  };

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeReferralCode(codeInput);
    if (code.length < MIN_REFERRAL_CODE_LENGTH) {
      toast.error("Enter a valid referral code.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/referrals/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        toast.success("Referral code applied!");
        setCodeInput("");
        router.refresh();
      } else {
        toast.error(data.error || "Couldn't apply that code.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  // ==== JSX ====
  return (
    <div className="space-y-6">
      {/* ---- How it works ---- */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          How it works
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li className="flex gap-2">
            <span className="font-semibold text-(--main-orange)">1.</span>
            Share your referral link or code with friends.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-(--main-orange)">2.</span>
            They sign up with it and subscribe to Premium.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-(--main-orange)">3.</span>
            You earn <strong>10 days</strong> of Premium per monthly
            subscription, or <strong>90 days</strong> per yearly subscription —
            added on top of the Premium days you already have.
          </li>
        </ol>
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          The reward is credited once per friend, on their first subscription
          payment only.
        </p>
      </section>

      {/* ---- Code + link ---- */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your referral code
        </h2>
        {referralCode ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-xl border border-dashed border-(--main-orange)/60 bg-(--main-orange)/5 px-4 py-2 text-lg font-bold tracking-wider text-zinc-900 dark:text-zinc-50">
                {referralCode}
              </code>
              <button
                type="button"
                onClick={() => copy(referralCode, "code")}
                className="visible-focus cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copied === "code" ? "Copied ✓" : "Copy code"}
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Your link
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={shareLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full truncate rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                />
                <button
                  type="button"
                  onClick={() => copy(shareLink, "link")}
                  className="visible-focus shrink-0 cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {copied === "link" ? "✓" : "Copy"}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="visible-focus mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-(--main-orange) px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share your referral link
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No referral code yet — refresh in a moment. (Codes are generated
            automatically; contact support if this persists.)
          </p>
        )}
      </section>

      {/* ---- Stats ---- */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your referrals
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Friends joined
            </dt>
            <dd className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {joinedCount + rewardedCount}
            </dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Subscribed
            </dt>
            <dd className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {rewardedCount}
            </dd>
          </div>
          <div className="rounded-xl bg-(--main-orange)/10 p-3">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Premium days earned
            </dt>
            <dd className="mt-1 text-xl font-bold text-(--main-orange)">
              {daysEarned}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
          {isExempt ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              Premium: <strong>unlimited</strong> (staff account)
            </p>
          ) : plan === "pro" && proExpiresAt ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              Premium active until{" "}
              <strong>
                {new Date(proExpiresAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </strong>
            </p>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">
              Current plan: <strong>Free</strong> — earn Premium days with your
              first successful referral.
            </p>
          )}
        </div>

        {/* ---- Referred accounts list (usernames only) ---- */}
        {referrals.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            {referrals.map((r) => (
              <li
                key={r.username}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <Link
                  href={`/${r.username}`}
                  className="visible-focus truncate text-sm font-medium text-zinc-700 hover:text-(--main-orange) dark:text-zinc-300 dark:hover:text-(--main-orange)"
                >
                  @{r.username}
                </Link>

                {r.status === "rewarded" ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/60 dark:text-green-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Subscribed · +{r.rewardDays}d
                  </span>
                ) : r.status === "revoked" ? (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
                    Reward revoked
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Joined
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Attach someone else's code (pre-feature free accounts) ---- */}
      {canEnterCode && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Have a referral code?
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Someone shared their code with you? Apply it before you subscribe
            and they&apos;ll get the credit. One code per account, and only
            before your first payment.
          </p>
          <form onSubmit={handleApplyCode} className="mt-3 flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. VICTORK2QP9"
              maxLength={30}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase tracking-wide text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={applying}
              className="visible-focus shrink-0 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
