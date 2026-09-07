"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist service worker.
 *
 * The service worker is served from `/serwist/sw.js` by the route handler at
 * app/serwist/[path]/route.ts (created via @serwist/turbopack's
 * createSerwistRoute). Serwist's handler sets `Service-Worker-Allowed: /`,
 * which permits a root scope ("/") even though the SW lives at /serwist/.
 *
 * Why production-only: Next.js dev server uses Hot Module Replacement and
 * on-the-fly assets that change every build. Caching them in dev causes stale
 * content / hard-to-debug issues. The Turbopack SW route is still available in
 * dev for manual testing, but we don't auto-register there.
 */
export default function SwRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // Ask the browser for PERSISTENT storage so the offline card snapshot
    // (localStorage) and the SW caches are never evicted under storage
    // pressure. Idempotent; installed PWAs are typically granted. Failure is
    // non-fatal — best-effort durability only.
    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }

    // Register after load so it never competes with first paint.
    const register = () => {
      navigator.serviceWorker
        .register("/serwist/sw.js", { scope: "/" })
        .catch((error) => {
          // Swallow — SW failure must never break the app UX.
          console.warn("[konneqta] SW registration failed:", error);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}