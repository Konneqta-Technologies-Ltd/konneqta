"use client";

/**
 * "Go Back" button — calls `window.history.back()`.
 *
 * Extracted into its own Client Component because it needs an `onClick`
 * handler (not allowed in Server Components). The parent page that uses
 * this (e.g. `app/not-found.tsx`) stays a Server Component so it can
 * export `metadata` and be statically prerendered.
 */
export default function GoBackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="w-30 rounded-lg border border-zinc-700 px-4 py-3 cursor-pointer text-sm font-medium text-white transition-colors hover:bg-zinc-800 "
    >
      ← &nbsp; Go Back
    </button>
  );
}