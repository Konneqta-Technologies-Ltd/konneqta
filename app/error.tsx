"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * 500 — route-level error boundary.
 *
 * Catches runtime errors thrown anywhere inside the App Router (Server or
 * Client Components) for this segment and its children. The `reset` prop
 * (provided by Next.js) re-renders the segment when clicked.
 *
 * Sentry automatically captures errors thrown during render, so we only need
 * to capture edge cases that might slip through (e.g. errors thrown in
 * effects triggered after the boundary caught the initial render).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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

      {/* 500 — orange to purple gradient */}
      <h1
        className="text-7xl font-extrabold tracking-tight sm:text-8xl"
        style={{
          backgroundImage: "linear-gradient(135deg, #FF6B2C, #8B5CF6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        500
      </h1>

      <h2 className="mt-4 text-xl font-semibold text-white sm:text-2xl">
        Something went wrong
      </h2>

      <p className="mt-3 max-w-md text-sm text-zinc-400 sm:text-base">
        {"An unexpected error occurred. Please try again."}
      </p>

      {/* Error digest — shown subtly for support/debugging */}
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-600">
          Error ID: {error.digest}
        </p>
      ) : null}

      {/* Actions */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        {/* Try Again — re-renders the segment */}
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
          style={{ backgroundColor: "#FF6B2C" }}
        >
          Try Again
        </button>

        {/* Go Home — purple accent */}
        <Link
          href="/"
          className="w-full rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}