"use client";

import DarkModeToggle from "@/components/DarkModeToggle";
import { useEffect, useState } from "react";

import InstallAppButton from "./InstallAppButton";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/lib/supabase/client";

/**
 * Slide-out side navigation drawer.
 *
 * Slides in from the left with a dark backdrop overlay. The action buttons
 * are stacked at the bottom of the drawer, with the Contact Us / Feedback
 * text links above them.
 *
 * The drawer header carries the dark/light mode toggle so every authenticated
 * page (profile, konneqts, settings, analytics, edit) gets theme control.
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
        // React 19 `inert` prop: when the drawer is closed, this makes ALL
        // descendants non-focusable and removes them from the accessibility
        // tree. This fixes the Lighthouse a11y failure where focusable
        // buttons/links (Close, Home, Install App, etc.) were reachable via
        // Tab inside an [aria-hidden="true"] container. `aria-hidden` alone
        // only hides from screen readers — it does NOT remove keyboard focus.
        inert={!open}
      >
        {/*
          BULLETPROOF A11Y: Only render the interactive content when the drawer
          is open. `inert` + `aria-hidden` hide it at runtime, but Lighthouse's
          STATIC DOM audit still flags any focusable element inside an
          aria-hidden container. By unmounting the content when closed, there
          are zero focusable elements in the DOM for the audit to find.
          The `<aside>` shell stays mounted so the slide-out CSS animation
          plays correctly.
        */}
        {open && (
        <>
        {/* ---- Header (title + theme toggle + close) ---- */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Menu
          </span>
          <div className="flex items-center gap-1">
            {/* Dark/Light toggle — gives every authenticated page
                (profile, konneqts, settings, analytics, edit) theme control
                right from the drawer. */}
            <DarkModeToggle className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800" />
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
        </div>

        {/* ---- Top nav links ---- */}
        <nav className="flex flex-col gap-1 p-3">
          <Link
            href="/"
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

              <Link
                href={`/${username}/konneqts`}
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 11h-6" />
                  <path d="M19 8v6" />
                </svg>
                Konneqts
              </Link>
            </>
          )}

          {isAuthenticated && (
            <Link
              href="/referral"
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
                <rect x="3" y="8" width="18" height="4" rx="1" />
                <path d="M12 8v13" />
                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
              </svg>
              Refer &amp; Earn
            </Link>
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
          {/* Contact Us / Feedback — plain left-aligned text links, stacked.
              Feedback routes to Settings, which hosts the "Share Feedback"
              button (no standalone /feedback page). Dark/light aware. */}
          <div className="flex flex-col items-start gap-1 pb-1 text-left">
            <Link
              href="/contact"
              onClick={onClose}
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Contact Us
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Feedback
            </Link>
          </div>

          <InstallAppButton />
          {isAuthenticated && <LogoutButton />}
        </div>
        </>
        )}
      </aside>
    </>
  );
}