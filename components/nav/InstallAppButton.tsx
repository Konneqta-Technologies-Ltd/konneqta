"use client";

import { useEffect, useState } from "react";

/**
 * Install App button — purple bg, white text.
 *
 * Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Samsung on
 * Android & desktop) and triggers the native install sheet when clicked.
 *
 * On iOS Safari (which doesn't support beforeinstallprompt), shows an
 * instruction card teaching the user to use Share → Add to Home Screen.
 *
 * Hidden entirely when:
 *   - The app is already installed (display-mode: standalone)
 *   - The browser doesn't support installation
 *   - The user previously dismissed the prompt (localStorage flag)
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Detect standalone mode (app already installed) — client-only, no SSR. */
function getStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Detect iOS Safari (no beforeinstallprompt support) — client-only. */
function getIsIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const ua = navigator.userAgent;
  // MSStream check excludes old IE/Edge which falsely matched iOS UA.
  const isOldEdge = "MSStream" in window;
  return /iPad|iPhone|iPod/.test(ua) && !isOldEdge;
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandalone] = useState(getStandalone);
  const [isIOS] = useState(getIsIOS);

  useEffect(() => {
    // Capture the install prompt event (Chromium browsers only).
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Don't render if installed, or if neither prompt nor iOS available.
  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "dismissed") {
        // Remember dismissal so we don't nag.
        localStorage.setItem("konneqta-install-dismissed", "1");
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#7751b8] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6543a0]"
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
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Install App
      </button>

      {/* ---- iOS Instructions Modal ---- */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Install Konneqta
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              To install on iOS:
            </p>
            <ol className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7751b8] text-xs font-bold text-white">
                  1
                </span>
                Tap the{" "}
                <svg
                  className="mx-0.5 inline h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                <strong>Share</strong> button in the Safari toolbar
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7751b8] text-xs font-bold text-white">
                  2
                </span>
                Select <strong>Add to Home Screen</strong>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7751b8] text-xs font-bold text-white">
                  3
                </span>
                Tap <strong>Add</strong>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full cursor-pointer rounded-lg bg-[#7751b8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6543a0]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}