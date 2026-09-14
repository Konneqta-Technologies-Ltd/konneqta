"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import SearchResultRow from "@/components/search/SearchResultRow";
import Spinner from "@/components/ui/Spinner";
import {
  SEARCH_MIN_QUERY_CHARS,
  type ProfileSearchResult,
} from "@/lib/search";

/** Debounce before a keystroke triggers a search request (ms). */
const DEBOUNCE_MS = 300;

/**
 * Shape of the latest search, keyed by the query it belongs to. All updates
 * happen inside async callbacks (timeout/fetch) — never synchronously in an
 * effect body (react-hooks/set-state-in-effect). Staleness is handled at
 * RENDER time (see the derived values in the component), not via resets.
 */
type SearchState = {
  q: string;
  loading: boolean;
  error: boolean;
  results: ProfileSearchResult[];
  hasMore: boolean;
};

const EMPTY_SEARCH: SearchState = {
  q: "",
  loading: false,
  error: false,
  results: [],
  hasMore: false,
};

/**
 * Profile search — navbar entry point for SIGNED-IN users.
 *
 * A magnifier button in AppNavbar's floating cluster (right of the QR
 * scanner). Clicking it expands a search input with a live-results dropdown
 * (15 closest matches, LIST form: avatar / name + @username / role ·
 * company). Rows link to `/{slug}?src=search` — the resulting profile view
 * is attributed to the "search" source in the owner's analytics.
 * When there are more matches, a "See more results" footer links to the
 * full paginated page at /search?q=…
 *
 * - Debounced (300ms) + AbortController so only the latest query's request
 *   lands; stale responses are discarded.
 * - Keyboard: ↑/↓ move the highlight, Enter opens, Escape closes.
 * - Closes on outside click. Guests never see the button (AppNavbar only
 *   renders this for authenticated users); the API is 401-gated regardless.
 */
export default function ProfileSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);

  const inputRef = useRef<HTMLInputElement>(null);
  // Wraps the trigger button AND the fixed dropdown panel, so the
  // outside-click handler can tell "inside" from "outside" clicks.
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const q = query.trim();

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    setSearch(EMPTY_SEARCH);
  }, []);

  // Focus the input whenever the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape / click-outside close while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  // Debounced search — aborts stale requests whenever the query changes.
  // All state updates live inside the timeout/async callbacks (the
  // react-hooks/set-state-in-effect rule forbids sync setState in the
  // effect body).
  useEffect(() => {
    if (!open || q.length < SEARCH_MIN_QUERY_CHARS) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearch({
        q,
        loading: true,
        error: false,
        results: [],
        hasMore: false,
      });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`search failed (${res.status})`);
        const data = (await res.json()) as {
          results: ProfileSearchResult[];
          hasMore: boolean;
        };
        setSearch({
          q,
          loading: false,
          error: false,
          results: data.results,
          hasMore: data.hasMore,
        });
        setActiveIndex(data.results.length > 0 ? 0 : -1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSearch({
          q,
          loading: false,
          error: true,
          results: [],
          hasMore: false,
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, q]);

  // Keyboard navigation inside the input: ↑/↓ cycle the highlight, Enter
  // opens the highlighted (or first) result.
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const { results } = search;
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        e.preventDefault();
        close();
        router.push(`/${target.slug}?src=search`);
      }
    }
  }

  // Render-time derivations (replace effect-body resets):
  //  - tooShort  → the typed query can't be searched yet
  //  - searching → a request for EXACTLY the current query is in flight
  //  - showResults → a finished, successful search with matches
  const tooShort = q.length < SEARCH_MIN_QUERY_CHARS;
  const searching = search.loading && search.q === q;
  const showResults =
    !tooShort && !searching && !search.error && search.results.length > 0;

  return (
    <div ref={wrapRef}>
      {/* Trigger — sits in AppNavbar's floating cluster (auth-gated there) */}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Search profiles"
        aria-expanded={open}
        className="cursor-pointer rounded-full p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      {/* Dropdown panel — below the floating cluster; near-full width on
          mobile, capped at sm on desktop. */}
      {open && (
        <div className="fixed top-16 left-4 z-40 w-[calc(100vw-2rem)] max-w-sm">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            {/* Input */}
            <div className="relative border-b border-zinc-200 dark:border-zinc-800">
              <svg
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
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
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Name, username, role, company…"
                aria-label="Search profiles"
                className="w-full bg-transparent py-3 pr-4 pl-10 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
              />
            </div>

            {/* Results — LIST form */}
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {tooShort ? (
                <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
                  Type at least {SEARCH_MIN_QUERY_CHARS} characters to search.
                </p>
              ) : searching ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500 dark:text-zinc-400">
                  <Spinner size="sm" /> Searching…
                </div>
              ) : search.error ? (
                <p className="py-6 text-center text-xs text-red-500 dark:text-red-400">
                  Something went wrong. Please try again.
                </p>
              ) : search.results.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
                  No profiles match &ldquo;{q}&rdquo;.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {search.results.map((result, i) => (
                    <li key={result.username}>
                      <SearchResultRow
                        result={result}
                        active={i === activeIndex}
                        onClick={close}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* See more → full paginated results page */}
            {showResults && search.hasMore && (
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                onClick={close}
                className="block border-t border-zinc-200 bg-zinc-50 py-2.5 text-center text-xs font-semibold text-(--main-orange) transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
              >
                See more results
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
