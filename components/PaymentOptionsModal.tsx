"use client";

import { PaymentType } from "@/lib/payments/plans";
import { toast } from "sonner";
import { useFlutterwavePayment } from "@/hooks/useFlutterwavePayment";
import { useState } from "react";

/**
 * Payment Options Modal — lets the user choose how to pay for Pro.
 *
 * Two independent choices:
 *   1. Billing cycle: Monthly (₦2,850/mo) vs Yearly (₦28,500/yr).
 *   2. Payment mode:  Auto-Renew (card only, Flutterwave Payment Plan,
 *      re-charges automatically) vs One-Time (card/transfer/USSD, expires,
 *      manual renewal).
 *
 * So a user can pick any of:
 *   - Monthly Auto-Renew   (paymentType="monthly", recurring=true)
 *   - Monthly One-Time     (paymentType="monthly", recurring=false)
 *   - Yearly Auto-Renew    (paymentType="yearly",  recurring=true)
 *   - Yearly One-Time      (paymentType="yearly",  recurring=false)
 *
 * Rendered by `UpgradeButton` when the owner doesn't have Pro.
 */

type BillingCycle = "monthly" | "yearly";

export default function PaymentOptionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [recurring, setRecurring] = useState(true);
  const { pay, loading, error } = useFlutterwavePayment();

  if (!open) return null;

  // Derived price/period for the header, based on the selected cycle.
  const price = cycle === "monthly" ? "₦950" : "₦9,500";
  const period = cycle === "monthly" ? "month" : "year";

  const handlePay = async () => {
    try {
      // CRITICAL: paymentType must be a key of PAYMENT_PLANS ("monthly" | "yearly").
      // Previously this sent "premium_upgrade" which doesn't exist → 400.
      await pay(cycle as PaymentType, recurring);
      // The hook redirects to /payment/callback — modal will unmount.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment failed to start.";
      toast.error(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Upgrade to Konneqta Pro
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Billing cycle toggle (Monthly / Yearly) */}
        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Billing cycle
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                cycle === "monthly"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
                cycle === "yearly"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Yearly
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/50 dark:text-green-400">
                SAVE 17%
              </span>
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">
              {price}
            </span>
            <span className="text-sm text-zinc-500">/ {period}</span>
          </div>
        </div>

        {/* Payment mode choice */}
        <div className="space-y-3">
          {/* Auto-Renew */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${
              recurring
                ? "border-[#FF6B2C] bg-orange-50 dark:bg-orange-950/30"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              name="billing"
              checked={recurring}
              onChange={() => setRecurring(true)}
              className="mt-1 accent-[#FF6B2C]"
            />
            <div className="flex-1">
              <div className="font-semibold text-zinc-900 dark:text-white">
                Pay with Card
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Charged automatically each {period}. Cancel anytime. Card only.
              </div>
            </div>
          </label>

          {/* One-Time */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${
              !recurring
                ? "border-[#8B5CF6] bg-purple-50 dark:bg-purple-950/30"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <input
              type="radio"
              name="billing"
              checked={!recurring}
              onChange={() => setRecurring(false)}
              className="mt-1 accent-[#8B5CF6]"
            />
            <div className="flex-1">
              <div className="font-semibold text-zinc-900 dark:text-white">
                Pay with Bank Transfer
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Pay with card, bank transfer, or USSD. Expires after{" "}
                {cycle === "monthly" ? "30 days" : "365 days"} — renew manually.
              </div>
            </div>
          </label>
        </div>

        {/* Error */}
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        {/* Pay button */}
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="mt-6 w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#FF6B2C" }}
        >
          {loading ? "Opening payment…" : `Pay ${price} & Upgrade`}
        </button>

        {/* Trust note */}
        <p className="mt-4 text-center text-xs text-zinc-400">
          Secured by Flutterwave. Your payment details are never stored on our
          servers.
        </p>
      </div>
    </div>
  );
}