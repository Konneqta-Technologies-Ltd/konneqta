"use client";

import OfflineCard from "@/components/OfflineCard";
import {
  readOfflineCardSnapshot,
  type OfflineCardSnapshot,
} from "@/lib/offline/card-snapshot";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Decides what the /offline page shows:
 *
 *   1. Installed PWA (display-mode: standalone / iOS standalone) AND a saved
 *      card snapshot exists → render the owner's card fully offline
 *      (OfflineCard), so launching the PWA with no network still opens to
 *      their card with a scannable QR.
 *   2. Otherwise → the generic "You're offline" screen (unchanged).
 *
 * PWA-only by design: regular browser tabs keep the generic experience.
 */
function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}

type Mode = "checking" | "card" | "fallback";

export default function OfflineExperience() {
  const [mode, setMode] = useState<Mode>("checking");
  const [snapshot, setSnapshot] = useState<OfflineCardSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred via a timer so we never call setState synchronously inside
    // the effect body (react-hooks/set-state-in-effect). The one-tick delay
    // is imperceptible — the placeholder is a plain black screen.
    const evaluate = () => {
      if (cancelled) return;
      if (isStandalonePwa()) {
        const snap = readOfflineCardSnapshot();
        if (snap) {
          setSnapshot(snap);
          setMode("card");
          return;
        }
      }
      setMode("fallback");
    };
    const timer = setTimeout(evaluate, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Blank black placeholder until we know which experience to show — avoids
  // flashing the generic screen before the card swaps in.
  if (mode === "checking") {
    return <main className="flex min-h-screen flex-col bg-black" />;
  }

  if (mode === "card" && snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <OfflineCard snapshot={snapshot} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-512.png"
        alt="Konneqta"
        width={120}
        height={120}
        className="mb-8 opacity-90"
      />
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {"You're offline"}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-400">
        {"We couldn't reach the internet to load this page. Reconnect to continue using Konneqta — profiles you've already visited will still be available here."}
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
      >
        Try again
      </Link>
    </main>
  );
}