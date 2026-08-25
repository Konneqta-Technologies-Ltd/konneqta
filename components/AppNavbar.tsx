"use client";

import { useEffect, useState } from "react";

import FeedbackTrigger from "./feedback/FeedbackTrigger";
import Link from "next/link";
import SideNav from "./nav/SideNav";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// Lazy-load the scanner only when the user opens it.
// html5-qrcode (~30KB) stays out of the main bundle.
const QrScanner = dynamic(() => import("./QrScanner"), { ssr: false });

// ── Route visibility tables (module scope so they're stable across renders) ──

// Hide the global navbar (hamburger + SideNav + QR scanner) on routes that
// are fully standalone (no app chrome).
const HIDDEN_ROUTES = [
  "/waitlist",
  "/home",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/post-login",
  "/privacy",
];

// Routes where the hamburger stays hidden even for signed-in users. The
// landing page ("/") is a standalone marketing surface: its Hero already
// links signed-in users to their card ("Hi, {name}"), so a floating menu
// button there is redundant. Every other page keeps the hamburger, so no
// nav destination becomes unreachable.
const HAMBURGER_HIDDEN_ROUTES = ["/"];

// Routes where something else already occupies the fixed top-right corner
// (DarkModeToggle on /terms, /refund, /contact, /auth/verify-reset) or the
// page has its own sign-up affordance (homepage Hero). The Sign Up pill
// mirrors the QR scan button's top-left placement for guests.
const SIGNUP_HIDDEN_ROUTES = [
  "/",
  "/terms",
  "/refund",
  "/contact",
  "/auth/verify-reset",
];

// Routes where the floating QR scan button is hidden (the landing page's
// Hero CTA is the primary action there).
const QR_HIDDEN_ROUTES = ["/"];

/**
 * App Navbar — floating action buttons with an auth-aware drawer.
 *
 * - The hamburger button (fixed top-left) is shown to signed-in users only,
 *   and never on the landing page ("/") — its Hero already links them to
 *   their card ("Hi, {name}").
 * - The QR scan button (next to the hamburger) is shown to ALL visitors so
 *   anyone can scan a Konneqta profile QR code.
 * - The drawer's action buttons (Logout, Delete Account) are auth-gated.
 */
export default function AppNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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

  // Hide the global navbar (hamburger + SideNav + QR scanner) on routes that
  // are fully standalone (no app chrome). Must come after all hooks (Rules of
  // Hooks).
  if (HIDDEN_ROUTES.includes(pathname)) return null;

  const showHamburger = !!user && !HAMBURGER_HIDDEN_ROUTES.includes(pathname);
  const showSignUp = !user && !SIGNUP_HIDDEN_ROUTES.includes(pathname);
  const showQrButton = !QR_HIDDEN_ROUTES.includes(pathname);

  return (
    <>
      {(showHamburger || showQrButton) && (
        <div className="fixed top-4 left-4 z-40 flex items-center gap-1">
          {/* Hamburger button — owners only (and never on the landing page).
              Visitors don't have app-nav destinations (Home/Analytics/
              Settings/Logout are auth-gated), so showing it to them is dead
              weight + an a11y trap (focusable controls inside a closed,
              aria-hidden drawer). */}
          {showHamburger && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
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
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          {/* QR Scan button — available to all visitors */}
          {showQrButton && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Scan QR code"
              className="cursor-pointer bg-(--main-orange) rounded-full p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:text-zinc-800 dark:hover:bg-zinc-200"
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
                <rect width="5" height="5" x="3" y="3" rx="1" />
                <rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" />
                <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" />
                <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                <path d="M3 12h.01" />
                <path d="M12 3h.01" />
                <path d="M12 16v.01" />
                <path d="M16 12h1" />
                <path d="M21 12v.01" />
                <path d="M12 21v-1" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Sign Up pill — top-right, guests only (mirrors the QR scan button
          on the left). Sends visitors to the signup page where they can
          register with email or Google. */}
      {showSignUp && (
        <Link
          href="/auth/signup"
          className="visible-focus fixed top-4 right-4 z-40 rounded-full bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Sign Up
        </Link>
      )}

      <SideNav
        open={open}
        onClose={() => setOpen(false)}
        isAuthenticated={!!user}
      />

      {/* QR Scanner — lazy-loaded, available to all visitors */}
      {scannerOpen && (
        <QrScanner onClose={() => setScannerOpen(false)} />
      )}

      {/*
        Feedback auto-trigger — only renders for authenticated users on app
        pages (this component returns null on legal/auth/waitlist routes via
        the HIDDEN_ROUTES check above, and the trigger self-gates on auth).
      */}
      {user && <FeedbackTrigger />}
    </>
  );
}