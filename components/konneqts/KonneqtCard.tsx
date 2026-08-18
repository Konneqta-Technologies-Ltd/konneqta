"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * A single connection in the Konneqts feed.
 *
 * Two variants share this component:
 *   1. Konneqta user   → `type: "user"` — whole card is a clickable Link to
 *      the other user's active card slug. Shows the Konneqta logo badge.
 *   2. Guest submission → `type: "guest"` — static (not clickable), shows the
 *      submitted name + note. No badge.
 *
 * Both show a relative "Connected X ago" timestamp because networking is
 * time-sensitive.
 */

export type KonneqtCardData = {
  id: string;
  type: "user" | "guest";
  displayName: string;
  // user-only:
  slug?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  // guest-only:
  note?: string | null;
  phone?: string | null;
  // shared:
  createdAt: string;
};

/**
 * Format a timestamp as a friendly relative string.
 * "Today", "Yesterday", "2 days ago", "Last week", "3 weeks ago",
 * "Last month", "5 months ago", "Last year", "2 years ago".
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "Last month";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  if (days < 730) return "Last year";
  return `${Math.floor(days / 365)} years ago`;
}

export default function KonneqtCard({ data }: { data: KonneqtCardData }) {
  const sublabel =
    data.type === "user"
      ? [data.jobTitle, data.company].filter(Boolean).join(" at ") || "Konneqta user"
      : data.phone
        ? data.phone
        : "Guest";

  const initial = (data.displayName || "?").charAt(0).toUpperCase();

  const inner = (
    <div
      className={`group relative flex h-full flex-col items-center rounded-2xl border bg-white p-5 text-center shadow-sm transition-all dark:bg-zinc-900 ${
        data.type === "user"
          ? "border-zinc-200 cursor-pointer hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
          : "border-dashed border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        {data.avatarUrl ? (
          <Image
            src={data.avatarUrl}
            alt={data.displayName}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-xl font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {initial}
          </div>
        )}

        {/* Konneqta logo badge — user connections only */}
        {data.type === "user" && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white dark:border-zinc-900"
            title="Konneqta user"
          >
            <Image
              src="/konneqta-logo.svg"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5"
            />
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="mt-3 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {data.displayName}
      </h3>
      <p className="mt-0.5 truncate text-xs text-balance text-zinc-500 dark:text-zinc-400">
        {sublabel}
      </p>

      {/* Guest note (if any) */}
      {data.type === "guest" && data.note && (
        <p className="mt-2 line-clamp-2 text-balance text-xs italic text-zinc-500 dark:text-zinc-400">
          &ldquo;{data.note}&rdquo;
        </p>
      )}

      {/* Relative time */}
      <p className="mt-auto pt-3 text-[11px] text-zinc-400 dark:text-zinc-600">
        Connected {relativeTime(data.createdAt)}
      </p>
    </div>
  );

  // Konneqta users: wrap the card in a Link so the whole card is clickable.
  if (data.type === "user" && data.slug) {
    return (
      <Link href={`/${data.slug}`} className="block h-full">
        {inner}
      </Link>
    );
  }

  return inner;
}