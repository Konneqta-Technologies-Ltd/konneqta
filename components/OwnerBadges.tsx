"use client";

import {
  ShareCountProvider,
  useShareCount,
} from "@/components/analytics/ShareCountProvider";

import PlanBadge from "@/components/PlanBadge";
import type { ReactNode } from "react";
import ShareCounter from "@/components/analytics/ShareCounter";
import UpgradeButton from "@/components/UpgradeButton";

/**
 * ShareLimitModal — the dialog shown when the owner has hit their monthly
 * share limit (0 remaining). Per the spec, the button just CLOSES the modal
 * (it does not navigate to a paywall); the CTA text still nudges them toward
 * upgrading.
 */
function ShareLimitModal({
  open,
  onClose,
  limit,
}: {
  open: boolean;
  onClose: () => void;
  limit: number;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-limit-title"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3
          id="share-limit-title"
          className="text-lg font-bold text-zinc-900 dark:text-white"
        >
          Share limit reached
        </h3>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {"You've used all "}
          {limit}
          {" of your free profile shares this month. Upgrade to "}
          <span className="font-semibold">Premium</span>
          {" for unlimited sharing and keep your profile everywhere."}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full cursor-pointer rounded-xl bg-(--main-orange) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * Inner cluster that renders the fixed top-right badges + the limit modal.
 * Kept separate so it can live INSIDE the ShareCountProvider (it consumes
 * the count + dismissed state from context).
 */
function OwnerCluster({ isPro }: { isPro: boolean }) {
  const { atLimit, limit, limitDismissed, dismissLimit } = useShareCount();

  return (
    <>
      {/* Fixed top-right cluster: [Upgrade] [ShareCounter] [PlanBadge] */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <UpgradeButton show={!isPro} />
        <ShareCounter />
        <PlanBadge isPro={isPro} show />
      </div>

      {/* Modal pops when the owner is at 0 shares and hasn't dismissed it. */}
      <ShareLimitModal
        open={atLimit && !limitDismissed}
        onClose={dismissLimit}
        limit={limit}
      />
    </>
  );
}

/**
 * OwnerBadges — the fixed top-right cluster shown ONLY to the profile owner.
 *
 * Wraps the page content in a ShareCountProvider so that:
 *   - PlanBadge + ShareCounter + UpgradeButton all sit side-by-side (no overlap)
 *   - the live share count drives the "0/limit" upgrade modal
 *   - the ShareMenu (nested inside `children` → ProfileCard) can call
 *     `refresh()` after a successful share to tick the badge down live, and
 *     can trigger the limit modal when the server returns 429.
 *
 * Rendering is driven by the parent's `isOwner` flag; when not the owner
 * this just renders `children` unmodified (no provider, no badges, no authed
 * /api/share/count fetch).
 */
export default function OwnerBadges({
  isOwner,
  isPro,
  children,
}: {
  isOwner: boolean;
  isPro: boolean;
  children: ReactNode;
}) {
  if (!isOwner) return <>{children}</>;

  return (
    <ShareCountProvider isPro={isPro}>
      <OwnerCluster isPro={isPro} />
      {children}
    </ShareCountProvider>
  );
}