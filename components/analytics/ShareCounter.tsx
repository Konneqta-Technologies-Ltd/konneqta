"use client";

import { PiInfinityBold } from "react-icons/pi";
import { useShareCount } from "./ShareCountProvider";

/**
 * ShareCounter — inline pill showing the owner's remaining monthly
 * shares, e.g. "12/25". Updates in real time after each share (the provider's
 * `refresh()` is called by ShareMenu when a share succeeds).
 *
 * - Pro / exempt users → "∞" (unlimited).
 * - Loading            → a subtle muted pill until the count resolves.
 * - At zero            → red pill to signal the limit was hit.
 *
 * This is purely informational; the actual enforcement is server-side.
 *
 * NOTE: This is an INLINE element (no `fixed`). It is placed inside the
 * top-right cluster by the parent page so it sits beside the plan badge
 * instead of covering it.
 */
export default function ShareCounter() {
  const { used, limit, remaining, unlimited, loading } = useShareCount();

  if (loading) {
    return (
      <div
        className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500"
        aria-hidden="true"
      >
        …
      </div>
    );
  }

  if (unlimited) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        title="Unlimited shares (Pro)"
      >
        <PiInfinityBold 
        size="1rem"
        color="orange"
           />
      </div>
    );
  }

  const atZero = remaining <= 0;

  return (
    <div
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
        atZero
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      }`}
      title={`Used ${used} of ${limit} shares this month`}
    >
      {remaining}/{limit}
    </div>
  );
}