"use client";

import { type Currency, PAYMENT_PLANS, PaymentType } from "@/lib/payments/plans";
import { toast } from "sonner";
import { useFlutterwavePayment } from "@/hooks/useFlutterwavePayment";
import { useEffect, useRef, useState } from "react";

/**
 * Payment Options Modal — lets the user choose how to pay for Pro.
 *
 * Three independent choices:
 *   1. Currency:      Naira (default) vs US Dollar — compact flag/symbol
 *                     dropdown beside the price.
 *   2. Billing cycle: Monthly vs Yearly.
 *   3. Payment mode:  NGN → Auto-Renew (card only, Flutterwave Payment Plan,
 *      re-charges automatically) vs One-Time (card/transfer/USSD, expires,
 *      manual renewal).
 *                     USD → Card auto-renew ONLY (bank transfer/USSD are
 *      Nigerian rails; the backend forces this too — see payment-service.ts).
 *
 * So a user can pick any of:
 *   - NGN Monthly/Yearly, Auto-Renew or One-Time
 *   - USD Monthly/Yearly, Card auto-renew only
 *
 * Rendered by `UpgradeButton` when the owner doesn't have Pro.
 */

type BillingCycle = "monthly" | "yearly";

/** Flag + symbol shown in the currency dropdown beside the price. */
const CURRENCIES: Record<
  Currency,
  { flag: string; symbol: string; label: string }
> = {
  NGN: { flag: "🇳🇬", symbol: "₦", label: "Naira" },
  USD: { flag: "🇺🇸", symbol: "$", label: "Dollar" },
};

export default function PaymentOptionsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [recurring, setRecurring] = useState(true);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const { pay, loading, error } = useFlutterwavePayment();

  // Close the currency dropdown on outside click / Escape.
  const currencyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!currencyOpen) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (
        currencyRef.current &&
        !currencyRef.current.contains(e.target as Node)
      ) {
        setCurrencyOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCurrencyOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [currencyOpen]);

  if (!open) return null;

  // Single source of truth: the plan registry drives BOTH the displayed
  // price and the backend charge, so UI and server can never drift.
  // payment_type stays the bare cycle ("monthly"/"yearly"); the currency
  // is passed separately and picks the price + Flutterwave Payment Plan.
  const isUsd = currency === "USD";
  const planKey: PaymentType = cycle;
  const variant = PAYMENT_PLANS[planKey].variants[currency];

  const { symbol } = CURRENCIES[currency];
  const price = `${symbol}${variant.amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
  const period = cycle === "monthly" ? "month" : "year";

  // "SAVE n%" badge on Yearly — computed per currency so it stays correct
  // (NGN ≈ 17%, USD ≈ 16%).
  const savePct = Math.round(
    (1 -
      PAYMENT_PLANS.yearly.variants[currency].amount /
        (PAYMENT_PLANS.monthly.variants[currency].amount * 12)) *
      100
  );

  const handlePay = async () => {
    try {
      // paymentType must be a key of PAYMENT_PLANS ("monthly" | "yearly");
      // the currency travels separately. USD is ALWAYS auto-renew — the
      // backend forces this even if a caller asks otherwise.
      await pay(planKey, isUsd ? true : recurring, currency);
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
                SAVE {savePct}%
              </span>
            </button>
          </div>
        </div>

        {/* Price + currency selector */}
        <div className="mb-6 text-center relative ">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">
              {price}
            </span>

            <span className="text-sm text-zinc-500">/ {period}</span>
          </div>

          {/* Currency dropdown — flag + symbol beside the price */}
            <div className="relative absolute -top-8 left-80" ref={currencyRef}>
              <button
                type="button"
                onClick={() => setCurrencyOpen((v) => !v)}
                aria-label="Select currency"
                aria-expanded={currencyOpen}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <span>{CURRENCIES[currency].flag}</span>
                <span>{symbol}</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${currencyOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {currencyOpen && (
                <ul className="absolute left-0 top-full z-10 mt-1 w-36 -translate-x-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency(c);
                          setCurrencyOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                          c === currency
                            ? "font-semibold text-zinc-900 dark:text-white"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        <span>{CURRENCIES[c].flag}</span>
                        <span>{CURRENCIES[c].label}</span>
                        <span className="ml-auto text-zinc-400">
                          {CURRENCIES[c].symbol}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          {/* {isUsd && (
            <p className="mt-1 text-xs text-zinc-400">
              USD is card payment with auto-renewal.
            </p>
          )} */}
        </div>

        {/* Payment mode choice — USD is card auto-renew ONLY */}
        <div className="space-y-3">
          {isUsd ? (
            <label className="flex items-start gap-3 rounded-xl border-2 border-[#FF6B2C] bg-orange-50 p-4 dark:bg-orange-950/30">
              <input
                type="radio"
                name="billing"
                checked
                readOnly
                className="mt-1 accent-[#FF6B2C]"
              />
              <div className="flex-1">
                <div className="font-semibold text-zinc-900 dark:text-white">
                  Pay with Card
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Charged {price} automatically every {period}. Cancel anytime.
                </div>
              </div>
            </label>
          ) : (
            <>
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
            </>
          )}
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