"use client";

import OfflineCard from "@/components/OfflineCard";
import {
  readOfflineCardSnapshot,
  type OfflineCardSnapshot,
} from "@/lib/offline/card-snapshot";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Client half of /launch (see app/launch/page.tsx for the full story).
 *
 * Splash → decide: online → replace to /post-login; offline (+ installed PWA
 * + saved snapshot) → the owner's card, fully interactive (flip, on-device
 * QR). Anything else offline → a short "you're offline" note.
 */

type Mode = "splash" | "card" | "offline-note";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}

/** Centered wordmark splash — shown for the online redirect hop and the
 *  one-tick decision pass. Never a blank black void. */
function Splash() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-512.png"
        alt="Konneqta"
        width={96}
        height={96}
        className="animate-pulse opacity-90"
      />
    </main>
  );
}

export default function LaunchExperience() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("splash");
  const [snapshot, setSnapshot] = useState<OfflineCardSnapshot | null>(null);

  useEffect(() => {
    // Decide on a timer (never setState synchronously in the effect body).
    const decide = () => {
      if (navigator.onLine) {
        router.replace("/post-login");
        return; // stay on the splash while the redirect resolves
      }
      if (isStandalonePwa()) {
        const snap = readOfflineCardSnapshot();
        if (snap) {
          setSnapshot(snap);
          setMode("card");
          return;
        }
      }
      setMode("offline-note");
    };
    const timer = setTimeout(decide, 0);

    // Connection came back while we were sitting on the offline card —
    // hop into the normal online routing.
    const onOnline = () => router.replace("/post-login");
    window.addEventListener("online", onOnline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  if (mode === "splash") return <Splash />;

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
      <h1 className="text-2xl font-bold tracking-tight">You&rsquo;re offline</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-400">
        Reconnect to load Konneqta. Your saved card will appear here
        automatically once the app has been opened online at least once.
      </p>
    </main>
  );
}
