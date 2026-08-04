"use client";

import { useMemo, useState } from "react";

import KonneqtCard, { type KonneqtCardData } from "./KonneqtCard";
import Link from "next/link";

/**
 * KonneqtsGrid — the responsive grid of connection cards + local search.
 *
 * Props:
 *   items      — the (already display-capped) list of connections to render.
 *   hiddenCount — how many more exist beyond the free-tier cap. When > 0,
 *                 a "🔒 N more · Upgrade" footer is shown. Pro users always
 *                 pass hiddenCount = 0.
 *
 * Search is purely client-side (filters by display name). It's here from Day
 * 1 because retrofitting it later is harder, and power networkers (50+ cards)
 * will need it.
 */
export default function KonneqtsGrid({
  items,
  hiddenCount = 0,
}: {
  items: KonneqtCardData[];
  hiddenCount?: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    // Search across name + message (so "Flutter" finds "Met you at Flutter
    // Meetup"). Phone is intentionally excluded to avoid accidental matches
    // on digits.
    return items.filter(
      (it) =>
        it.displayName.toLowerCase().includes(q) ||
        (it.note?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  return (
    <div>
      {/* Search */}
      {items.length > 0 && (
        <div className="mb-5 max-w-md">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Konneqts…"
              aria-label="Search Konneqts"
              className="w-full rounded-full border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors focus:border-(--main-orange) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => (
            <KonneqtCard key={item.id} data={item} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-600">
          No Konneqts match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <EmptyState />
      )}

      {/* Free-tier locked footer */}
      {hiddenCount > 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {hiddenCount} more {hiddenCount === 1 ? "Konneqt" : "Konneqts"}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Upgrade to Pro to see your full network.
          </p>
          <Link
            href="/payment"
            className="mt-4 inline-block rounded-lg bg-(--main-orange) px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Upgrade
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={26}
          height={26}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-400"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 11h-6" />
          <path d="M19 8v6" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        No Konneqts yet
      </h3>
      <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
        {"Share your card or scan someone's QR code. When people connect with you, they'll appear here."}
      </p>
    </div>
  );
}