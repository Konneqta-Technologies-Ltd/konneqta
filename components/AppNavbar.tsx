"use client";

import { useEffect, useState } from "react";

import SideNav from "./nav/SideNav";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * App Navbar — auth-gated wrapper.
 *
 * Renders a hamburger button (fixed top-left, mirrors DarkModeToggle) that
 * opens a slide-out SideNav drawer. Only visible to authenticated users.
 * Visitors (not logged in) see nothing.
 *
 * Uses Supabase onAuthStateChange to reactively show/hide based on login
 * state — no server round-trip needed.
 */
export default function AppNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Get initial user.
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Subscribe to auth changes (login / logout).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't render anything for visitors.
  if (!user) return null;

  return (
    <>
      {/* Hamburger button — fixed top-left (mirrors DarkModeToggle top-right) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-4 left-4 z-40 rounded-full p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <SideNav open={open} onClose={() => setOpen(false)} />
    </>
  );
}