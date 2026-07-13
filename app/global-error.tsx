"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Global Error — the last-resort error boundary.
 *
 * This catches errors that `app/error.tsx` cannot — specifically, errors
 * thrown by the root `app/layout.tsx` itself. Because the layout is what
 * failed, this component must render its OWN `<html>` and `<body>` tags
 * (unlike `error.tsx`, which inherits them from the layout).
 *
 * There is no `reset()` here because a layout-level failure usually requires
 * a full page reload to recover.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10 text-center text-white">
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
          {"An unexpected error occurred. Please reload the page."}
        </p>

        {/* Error digest — shown subtly for support/debugging */}
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-zinc-600">
            Error ID: {error.digest}
          </p>
        ) : null}

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {/* Reload — full page refresh via native browser API (safe in
              global-error where the Next.js router may not be available) */}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            style={{ backgroundColor: "#FF6B2C" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}