/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Serwist service worker source (Turbopack build).
 *
 * @serwist/turbopack compiles this at build time and serves it from the route
 * handler at app/serwist/route.ts (endpoint: /serwist.js). It provides:
 *   - Precaching of the Next.js app shell (_next/static).
 *   - Runtime caching (ordered — FIRST match wins):
 *       1. Navigations → NetworkFirst (3s timeout) so any page viewed online
 *          (cards included) is available offline.
 *       2. Images → StaleWhileRevalidate (avatars, banners, logos,
 *          /_next/image output) so offline cards render their images.
 *       3. Catch-all → NetworkOnly: APIs, auth, analytics and Supabase
 *          queries are NEVER cached.
 *   - Offline fallback to /offline when a navigation fails with no cache.
 *     For the installed PWA, /offline renders the owner's saved card
 *     (lib/offline/card-snapshot.ts) — card + scannable QR with no network.
 *
 * NOTE: do NOT reintroduce `defaultCache` from @serwist/turbopack/worker
 * before these rules — it is a single catch-all NetworkOnly entry that
 * swallows every request and silently disables ALL runtime caching above
 * (first match wins).
 *
 * IMPORTANT: auth callbacks, the vCard route, /post-login and PostHog
 * analytics (/ingest) are never cached — they must always hit the network.
 */

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import type { RouteMatchCallback, RouteMatchCallbackOptions } from "serwist";

import {
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

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

// Exclude auth callbacks, the vCard route and /post-login from navigation
// caching.
const navigationMatcher: RouteMatchCallback = ({
  url,
  request,
}: RouteMatchCallbackOptions) => {
  return (
    request.mode === "navigate" &&
    // Auth callbacks must always hit the network (they exchange one-time
    // codes for sessions — a cached response would break login).
    !url.pathname.startsWith("/auth/") &&
    // The vCard download must never be served stale.
    !url.pathname.endsWith("/vcard") &&
    // /post-login is a server-side redirect to the user's ACTIVE card.
    // Caching it could pin a stale redirect target, so it stays uncached:
    // online it redirects normally; offline it falls through to /offline,
    // which renders the owner's saved card snapshot.
    !url.pathname.startsWith("/post-login")
  );
};

// Images: avatars, banners, logos and /_next/image optimizer output. Serve
// from cache instantly, refresh the cache when online. StaleWhileRevalidate
// (not CacheFirst) so an updated avatar shows on the next online view
// instead of being pinned for the whole expiration window.
const imageMatcher: RouteMatchCallback = ({
  request,
}: RouteMatchCallbackOptions) => request.destination === "image";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: navigationMatcher,
      handler: navigationStrategy,
    },
    {
      matcher: imageMatcher,
      handler: new StaleWhileRevalidate({
        cacheName: "konneqta-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 80,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // Explicit catch-all, LAST: everything else (APIs, auth, analytics,
    // Supabase REST) is never cached. Same intent as @serwist/turbopack's
    // defaultCache — but placed after the custom rules, not before.
    {
      matcher: /.*/,
      handler: new NetworkOnly(),
    },
  ],
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