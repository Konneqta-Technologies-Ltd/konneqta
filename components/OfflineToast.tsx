"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Global offline indicator — a slim toast pinned to the top of EVERY page
 * (mounted once in app/layout.tsx), replacing the old "whole page goes
 * offline" experience:
 *
 *   offline  → amber "You're offline — showing saved content" pill slides in
 *   back on  → brief green "Back online" confirmation, then it dismisses
 *
 * Driven by the browser's online/offline events. Rendered only after mount
 * (SSR renders nothing — no hydration mismatch) and pointer-events-none so
 * it never blocks the UI underneath.
 */
export default function OfflineToast() {
  const [offline, setOffline] = useState(false);
  const [backOnlinePulse, setBackOnlinePulse] = useState(false);

  useEffect(() => {
    const evaluate = () => setOffline(!navigator.onLine);
    // Timer so no setState runs synchronously in the effect body.
    const initial = window.setTimeout(evaluate, 0);

    const handleOffline = () => setOffline(true);
    const handleOnline = () => {
      setOffline(false);
      setBackOnlinePulse(true);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    let pulseTimer = 0;
    if (backOnlinePulse) {
      pulseTimer = window.setTimeout(() => setBackOnlinePulse(false), 2500);
    }

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(pulseTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [backOnlinePulse]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4"
    >
      <AnimatePresence>
        {offline && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-zinc-900/95 px-4 py-2 text-xs font-medium text-amber-300 shadow-lg backdrop-blur"
          >
            {/* wifi-off icon (lucide style — consistent with app icons) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="2" x2="22" y1="2" y2="22" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0" />
              <path d="M2 8.82a15 15 0 0 1 20 0" />
              <path d="M5 12.859a10 10 0 0 1 14 0" />
            </svg>
            You&rsquo;re offline — showing saved content
          </motion.div>
        )}

        {!offline && backOnlinePulse && (
          <motion.div
            key="back-online"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-zinc-900/95 px-4 py-2 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 13a10 10 0 0 1 14 0" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0" />
              <path d="M2 8.82a15 15 0 0 1 20 0" />
              <line x1="12" x2="12.01" y1="20" y2="20" />
            </svg>
            Back online
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
