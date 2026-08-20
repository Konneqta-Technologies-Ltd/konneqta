"use client";

/**
 * "Go Back" button — calls `window.history.back()`.
 *
 * Extracted into its own Client Component because it needs an `onClick`
 * handler (not allowed in Server Components). The parent page that uses
 * this (e.g. `app/not-found.tsx`) stays a Server Component so it can
 * export `metadata` and be statically prerendered.
 *
 * Dark/light aware: neutral border + text in light mode, inverted in dark.
 */
export default function GoBackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="w-30 cursor-pointer rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
    >
      ← &nbsp; Go Back
    </button>
  );
}