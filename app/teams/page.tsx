import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { FaCheck } from "react-icons/fa";

export const metadata: Metadata = {
  // absolute: full control over the <title> — the root layout's
  // "%s · Konneqta" template would render
  // "Konneqta for Teams — Coming Soon · Konneqta".
  title: { absolute: "Konneqta for Teams — Coming Soon" },
  description:
    "Konneqta for Teams is coming soon — shared branding, admin controls, and bulk digital business cards for your whole team.",
  // Unlaunched feature page — same noindex pattern as /launch and the 404.
  // Intentionally NOT listed in app/sitemap.ts (a sitemap URL must be
  // indexable).
  robots: { index: false, follow: false },
};

const teamFeatures = [
  "Centralized team branding",
  "Bulk card management",
  "Verify staff & update info anytime",
  "Deactivate cards when someone leaves",
];

/**
 * /teams — "Coming soon" landing page for Konneqta for Teams.
 *
 * The Teams app (teams.konneqta.com) is NOT live yet, so the homepage
 * "For teams" nav link and the signup page's "Create a team workspace"
 * link point here instead of the dead external signup URL.
 *
 * When Teams launches: repoint those two links back to getTeamsSignupUrl()
 * (lib/teams-url.ts — kept for exactly that moment; see README's "Testing
 * Konneqta Teams locally") and repurpose this page as the marketing entry
 * for the Teams product.
 *
 * Uses the brand palette: black canvas, white text, purple + orange accents
 * (same treatment as app/not-found.tsx).
 */
export default function TeamsComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10 text-center text-white">
      <Image
        src="/icons/icon-512.png"
        alt="Konneqta"
        width={100}
        height={100}
        className="mb-8 opacity-90"
      />

      {/* Pill badge — mirrors the Hero badge */}
      <span className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 sm:text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B2C]" />
        Coming soon
      </span>

      {/* Konneqta for Teams — orange to purple gradient */}
      <h1
        className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl"
        style={{
          backgroundImage: "linear-gradient(135deg, #FF6B2C, #8B5CF6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Konneqta for Teams
      </h1>

      <p className="mt-5 max-w-md text-sm text-zinc-300 sm:max-w-xl sm:text-base">
        One workspace to bring everyone&apos;s identity together — shared
        branding, admin controls, and bulk cards for your whole team.
      </p>

      <ul className="mt-8 grid max-w-md grid-cols-1 gap-3 text-left text-sm text-zinc-300 sm:max-w-xl sm:grid-cols-2">
        {teamFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <FaCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD9A6]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        {/* Back to landing page — brand orange */}
        <Link
          href="/"
          className="visible-focus w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
          style={{ backgroundColor: "#FF6B2C" }}
        >
          Back to Konneqta
        </Link>

        {/* Secondary — route interest to the live individual product */}
        <Link
          href="/auth/signup"
          className="visible-focus w-full rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 sm:w-auto"
        >
          Create your own card
        </Link>
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        Questions?{" "}
        <a
          href="mailto:info@konneqta.com"
          className="text-(--main-orange) hover:underline"
        >
          info@konneqta.com
        </a>
      </p>
    </main>
  );
}
