"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Search input for the /search results page. Controlled locally; submitting
 * pushes a clean `/search?q=...` URL (page resets to 1) so results stay
 * shareable/back-button friendly. Styling mirrors the KonneqtsGrid search
 * input (rounded-full, zinc palette, dark-mode aware, orange focus border).
 */
export default function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
      className="relative"
    >
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
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name, username, role, company…"
        aria-label="Search profiles"
        className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pr-4 pl-10 text-sm text-zinc-900 outline-none transition-colors focus:border-(--main-orange) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </form>
  );
}
