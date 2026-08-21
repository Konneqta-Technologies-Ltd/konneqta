"use client";

import { useSyncExternalStore } from "react";

function getIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/**
 * Dark/Light mode toggle button.
 *
 * - Default (no className): fixed top-right icon button — used on standalone
 *   pages (legal, auth, etc.) where nothing else occupies the corner.
 * - With className: fully inline/class-driven — used inside clusters like the
 *   profile owner badges row or the SideNav drawer.
 *
 * Shows a sun icon in dark mode (tap → light) and a moon icon in light mode
 * (tap → dark). The choice is persisted to localStorage and applied by
 * toggling the `.dark`/`.light` classes on <html>.
 */
export default function DarkModeToggle({
  className,
}: {
  className?: string;
}) {
  const isDark = useSyncExternalStore(subscribe, getIsDark, getServerSnapshot);

  function toggleTheme() {
    if (isDark) {
      // Add .light so the prefers-color-scheme fallback in globals.css
      // (:root:not(.light)) can't re-apply dark variables after an
      // explicit light choice.
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }

  const defaultClassName =
    "fixed top-4 right-4 z-50 rounded-full p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={className ?? defaultClassName}
    >
      {isDark ? (
        /* Sun icon */
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
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon */
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
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}