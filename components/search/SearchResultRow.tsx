import Image from "next/image";
import Link from "next/link";

import type { ProfileSearchResult } from "@/lib/search";

/**
 * One profile search result as a LIST row: avatar → name + @username →
 * role · company (small fonts). Shared by the navbar dropdown and the
 * /search results page so both surfaces stay visually identical.
 *
 * Server-component safe (no hooks); client parents import it as-is.
 * The whole row is a Link to the profile's public page with ?src=search so
 * the resulting view is attributed to "search" in the owner's analytics.
 */
export default function SearchResultRow({
  result,
  active = false,
  onClick,
}: {
  result: ProfileSearchResult;
  /** Dropdown keyboard-navigation highlight. */
  active?: boolean;
  /** Passed through to the Link (the dropdown closes itself on click). */
  onClick?: () => void;
}) {
  const hasName = !!result.fullName?.trim();
  const displayName = hasName ? result.fullName!.trim() : `@${result.username}`;
  const sublabel = [result.jobTitle, result.company]
    .filter(Boolean)
    .join(" · ");
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href={`/${result.slug}?src=search`}
      onClick={onClick}
      aria-label={`${displayName} — @${result.username}`}
      className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
        active
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {/* Avatar (or initial fallback, the KonneqtCard pattern) */}
      {result.avatarUrl ? (
        <Image
          src={result.avatarUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--main-orange)/10 text-sm font-bold text-(--main-orange)">
          {initial}
        </span>
      )}

      {/* Name + @username, then role · company below in small type */}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {displayName}
          </span>
          {hasName && (
            <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
              @{result.username}
            </span>
          )}
        </span>
        {sublabel ? (
          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {sublabel}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
