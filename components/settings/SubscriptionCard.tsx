"use client";

import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * SubscriptionCard — the web half of Pro-subscription management (the mobile
 * Settings "Pro Membership" section's twin). Renders the caller's plan state
 * from GET /api/payments/subscription and offers:
 *
 *   • Flutterwave auto-renewal → cancel via POST
 *     /api/payments/cancel-subscription (Pro continues until the paid period
 *     ends; the server REFUSES store-billed rows).
 *   • Store-billed (Qonversion — subscribed in the mobile app) → link out to
 *     the store's subscription management; the OS owns those cancellations.
 *   • No subscription → Upgrade to Pro (landing pricing section).
 *
 * Fetch failure renders NOTHING — this card must never break /settings.
 */

type SubscriptionInfo = {
  active: boolean;
  billing: "flutterwave" | "store" | "none";
  planLabel: string | null;
  productId: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Store subscription management for a (rare) web visitor whose subscription
 * came from the mobile app. Best-effort platform guess from the UA: Apple
 * devices → App Store subscriptions, everything else → Play (SKU-scoped
 * when the store product id is known).
 */
function storeManageUrl(productId: string | null): string {
  const isApple =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  if (isApple) return "https://apps.apple.com/account/subscriptions";
  return productId
    ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=com.konneqta.mobile`
    : "https://play.google.com/store/account/subscriptions";
}

export default function SubscriptionCard() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/payments/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setSub((data?.data as SubscriptionInfo | undefined) ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/payments/cancel-subscription", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not cancel the subscription.");
      }
      toast.success(data.message || "Auto-renewal cancelled.");
      // Optimistic: the row is cancelled server-side; Pro continues until
      // current_period_end (now displayed as "Pro ends").
      setSub((prev) => (prev ? { ...prev, cancelAtPeriodEnd: true } : prev));
      setShowCancel(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel the subscription."
      );
    } finally {
      setCancelling(false);
    }
  }

  if (!loaded || !sub) return null;

  const planText = sub.active
    ? sub.planLabel && sub.planLabel !== "Pro"
      ? `Pro · ${sub.planLabel}`
      : "Pro"
    : "Free";

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Pro Membership
      </h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-zinc-500 dark:text-zinc-400">Plan</dt>
          <dd className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {planText}
          </dd>
        </div>
        {sub.active && sub.renewsAt && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">
              {sub.cancelAtPeriodEnd ? "Pro ends" : "Renews"}
            </dt>
            <dd className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {formatDate(sub.renewsAt)}
            </dd>
          </div>
        )}
      </dl>

      {sub.active && sub.billing === "flutterwave" && !sub.cancelAtPeriodEnd && (
        <div className="mt-4">
          <button
            onClick={() => setShowCancel(true)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-200"
          >
            Cancel auto-renewal
          </button>
        </div>
      )}

      {sub.active && sub.billing === "store" && (
        <div className="mt-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Billed through the App Store / Google Play — cancellations and
            refunds are managed there.
          </p>
          <a
            href={storeManageUrl(sub.productId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-200"
          >
            Manage subscription ↗
          </a>
        </div>
      )}

      {!sub.active && (
        <div className="mt-4">
          <Link
            href="/#pricing"
            className="inline-block rounded-lg bg-(--main-orange) px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      <Modal
        open={showCancel}
        onClose={() => {
          if (!cancelling) setShowCancel(false);
        }}
        dismissable={!cancelling}
        aria-label="Cancel auto-renewal"
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Cancel auto-renewal?
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You&apos;ll keep Pro until the end of your current billing period.
          Your card won&apos;t be charged again.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setShowCancel(false)}
            disabled={cancelling}
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            Keep subscription
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {cancelling && <Spinner size="sm" className="text-white" />}
            Cancel renewal
          </button>
        </div>
      </Modal>
    </section>
  );
}