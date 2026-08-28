"use client";

/**
 * Promo code redemption card (Settings page).
 *
 * Input + Redeem button → POST /api/promos/redeem → the atomic DB RPC grants
 * +N Premium days (stacking on whatever the user has left). On success the
 * toast celebrates and router.refresh() re-renders the server page so the
 * plan/expiry info updates immediately.
 *
 * Below the input: the user's redeemed codes — rendered ONLY when at least
 * one exists (per spec: "if not used, nothing shows").
 */

import { isPlausiblePromoCode, normalizePromoCode } from "@/lib/promos/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

export type RedeemedPromo = {
  code: string;
  days: number;
  redeemedAt: string;
};

export default function PromoRedeemCard({
  redeemed,
  disabled = false,
}: {
  redeemed: RedeemedPromo[];
  /** Hide the input for exempt (staff) accounts — they're already unlimited. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePromoCode(code);
    if (!isPlausiblePromoCode(normalized)) {
      toast.error("Enter a valid promo code.");
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/promos/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        daysGranted?: number;
      };
      if (res.ok) {
        toast.success(
          `🎉 +${data.daysGranted ?? 0} days of Premium added to your account!`
        );
        setCode("");
        router.refresh();
      } else {
        toast.error(data.error || "Couldn't redeem that code.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  if (disabled) return null;

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Promo code
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Got a Konneqta promo code? Redeem it for free Premium days — they stack
        on any days you already have.
      </p>

      <form onSubmit={handleRedeem} className="mt-4 flex max-w-sm gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME30"
          autoComplete="off"
          maxLength={30}
          aria-label="Promo code"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase tracking-wide text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
        <button
          type="submit"
          disabled={redeeming}
          className="visible-focus shrink-0 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
      </form>

      {redeemed.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {redeemed.map((r) => (
            <li
              key={`${r.code}-${r.redeemedAt}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-medium tracking-wide text-zinc-700 dark:text-zinc-300">
                {r.code}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                +{r.days} days ·{" "}
                {new Date(r.redeemedAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
