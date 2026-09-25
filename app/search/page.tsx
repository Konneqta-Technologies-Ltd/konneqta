import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import SearchBar from "@/components/search/SearchBar";
import SearchResultRow from "@/components/search/SearchResultRow";
import {
  SEARCH_MIN_QUERY_CHARS,
  SEARCH_PAGE_SIZE,
  sanitizeSearchQuery,
  searchProfiles,
  type ProfileSearchResult,
} from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Search",
  // Private, authenticated utility page — keep it out of search engines.
  robots: { index: false, follow: false },
};

/** Hard cap on the page number (defensive — keeps offsets bounded). */
const MAX_PAGE = 50;

/**
 * /search — full profile search results (LOGGED-IN ONLY).
 *
 * The navbar dropdown's "See more results" lands here. List-form results
 * (avatar / name + @username / role · company), 15 per page, with Prev/Next
 * pagination that preserves the query. Uses the same searchProfiles logic
 * as /api/search so both surfaces rank identically.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: rawQuery, page: rawPage } = await searchParams;

  // Auth gate — search is an authenticated-only feature.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const query = sanitizeSearchQuery(rawQuery ?? "");
  const pageNum = Math.max(
    1,
    Math.min(MAX_PAGE, Number.parseInt(rawPage ?? "1", 10) || 1),
  );
  const searchable = query.length >= SEARCH_MIN_QUERY_CHARS;

  let results: ProfileSearchResult[] = [];
  let hasMore = false;
  let failed = false;
  if (searchable) {
    try {
      ({ results, hasMore } = await searchProfiles(supabase, {
        query,
        callerId: user.id,
        limit: SEARCH_PAGE_SIZE,
        offset: (pageNum - 1) * SEARCH_PAGE_SIZE,
      }));
    } catch (err) {
      console.error("[search page] search failed:", err);
      failed = true;
    }
  }

  const pageHref = (n: number) =>
    `/search?q=${encodeURIComponent(query)}${n > 1 ? `&page=${n}` : ""}`;

  const pagerLink =
    "rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Search
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Find people by name, username, role, or company.
      </p>

      <div className="mt-5">
        <SearchBar initialQuery={query} />
      </div>

      {/* Results — LIST form (avatar / name + @username / role · company) */}
      {searchable && results.length > 0 && (
        <ul className="mt-6 space-y-1">
          {results.map((result) => (
            <li key={result.username}>
              <SearchResultRow result={result} />
            </li>
          ))}
        </ul>
      )}

      {/* States */}
      {!searchable ? (
        <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-600">
          Type at least {SEARCH_MIN_QUERY_CHARS} characters to search.
        </p>
      ) : failed ? (
        <p className="mt-10 text-center text-sm text-red-500 dark:text-red-400">
          Search failed. Please try again.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-600">
          No profiles match &ldquo;{query}&rdquo;.
        </p>
      ) : null}

      {/* Pagination — Prev / page indicator / Next, query preserved */}
      {searchable && results.length > 0 && (pageNum > 1 || hasMore) && (
        <nav
          className="mt-8 flex items-center justify-between"
          aria-label="Search results pagination"
        >
          {pageNum > 1 ? (
            <Link href={pageHref(pageNum - 1)} className={pagerLink} rel="prev">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Page {pageNum}
          </span>
          {hasMore ? (
            <Link href={pageHref(pageNum + 1)} className={pagerLink} rel="next">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
