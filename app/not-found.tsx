import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found · Konneqta",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: false },
};

/**
 * 404 — shown when no route matches the URL.
 *
 * Uses the brand palette: black canvas, white text, purple + orange accents.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-512.png"
        alt="Konneqta"
        width={100}
        height={100}
        className="mb-8 opacity-90"
      />

      {/* 404 — orange to purple gradient */}
      <h1
        className="text-7xl font-extrabold tracking-tight sm:text-8xl"
        style={{
          backgroundImage: "linear-gradient(135deg, #FF6B2C, #8B5CF6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        404
      </h1>

      <h2 className="mt-4 text-xl font-semibold text-white sm:text-2xl">
        Page not found
      </h2>

      <p className="mt-3 max-w-md text-sm text-zinc-400 sm:text-base">
        {"The page you're looking for doesn't exist or may have been moved."}
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        {/* Go Back — uses browser history */}
        <button
          type="button"
          onClick={() => window.history.back()}
          className="w-full rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
        >
          ← Go Back
        </button>

        {/* Go Home — brand orange */}
        <Link
          href="/"
          className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
          style={{ backgroundColor: "#FF6B2C" }}
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}