"use client";

import { useEffect, useState } from "react";

import InstallAppButton from "./InstallAppButton";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/lib/supabase/client";

/**
 * Slide-out side navigation drawer.
 *
 * Slides in from the left with a dark backdrop overlay. The three action
 * buttons are stacked at the bottom of the drawer.
 *
 * Closes on: backdrop click, Escape key, or button activation (each button
 * handles its own routing).
 */
export default function SideNav({
  open,
  onClose,
  isAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}) {
  // Resolve the signed-in user's primary card slug so we can link to their
  // profile + analytics. Fetched once when the drawer is first opened by an
  // authenticated user.
  const [username, setUsername] = useState<string | null>(null);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!isAuthenticated || username) return;
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active || !user) return;
        const { data: card } = await supabase
          .from("cards")
          .select("slug")
          .eq("owner_id", user.id)
          .eq("is_primary", true)
          .maybeSingle();
        if (active && card?.slug) setUsername(card.slug);
      } catch {
        // Non-fatal — the nav links just won't render the username path.
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, username]);

  return (
    <>
      {/* ---- Backdrop ---- */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ---- Drawer ---- */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-72 max-w-[80vw] flex-col border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation menu"
        aria-hidden={!open}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ---- Top nav links ---- */}
        <nav className="flex flex-col gap-1 p-3">
          <Link
            href="/home"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-400"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </Link>

          {isAuthenticated && username && (
            <>
              <Link
                href={`/${username}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-400"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Card
              </Link>

              <Link
                href={`/${username}/analytics`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-zinc-400"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
                Analytics
              </Link>
            </>
          )}

          {isAuthenticated && (
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-400"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </Link>
          )}
        </nav>

        {/* ---- Spacer (pushes buttons to bottom) ---- */}
        <div className="flex-1" />

        {/* ---- Action buttons (bottom, stacked) ---- */}
        <div className="space-y-3 border-t border-zinc-200 p-5 dark:border-zinc-800">
          <InstallAppButton />
          {isAuthenticated && <LogoutButton />}
        </div>
      </aside>
    </>
  );
}