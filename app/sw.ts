/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Serwist service worker source (Turbopack build).
 *
 * @serwist/turbopack compiles this at build time and serves it from the route
 * handler at app/serwist/route.ts (endpoint: /serwist.js). It provides:
 *   - Precaching of the Next.js app shell (_next/static).
 *   - Runtime caching: navigation, static assets, images, fonts.
 *   - Offline fallback to /offline when a navigation fails with no cache.
 *
 * IMPORTANT: auth callbacks, the vCard route, and PostHog analytics
 * (/ingest) are never cached — they must always hit the network.
 */

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import type { RouteMatchCallback, RouteMatchCallbackOptions } from "serwist";

import { NetworkFirst } from "serwist";
import { Serwist } from "serwist";
import { defaultCache } from "@serwist/turbopack/worker";

// Navigation strategy: network-first with a 3s timeout, falling back to cache
// (and ultimately /offline) when offline.
const navigationStrategy = new NetworkFirst({
  cacheName: "konneqta-pages",
  networkTimeoutSeconds: 3,
});

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the actual precache
// manifest. By default, this string is set to `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Exclude auth callbacks and the vCard route from navigation caching.
const navigationMatcher: RouteMatchCallback = ({
  url,
  request,
}: RouteMatchCallbackOptions) => {
  return (
    request.mode === "navigate" &&
    !url.pathname.startsWith("/auth/") &&
    !url.pathname.endsWith("/vcard")
  );
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache.concat([
    {
      matcher: navigationMatcher,
      handler: navigationStrategy,
    },
  ]),
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();