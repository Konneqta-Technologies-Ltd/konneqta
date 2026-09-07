import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

/**
 * Serwist route handler (Turbopack-native).
 *
 * Serves the compiled service worker at `/serwist.js` (and related assets).
 * @serwist/turbopack compiles app/sw.ts (with the precache manifest injected)
 * at build time; this route streams it out with the correct content type and
 * a long cache lifetime in production.
 *
 * Placed under a dynamic `[path]` segment because @serwist/turbopack's GET
 * handler expects a `{ path: string }` param (the SW asset path).
 *
 * Registered from components/SwRegister.tsx as
 * `navigator.serviceWorker.register("/serwist.js")`.
 */
// A revision helps Serwist version the precached offline fallback page so
// stale responses are never served. Using the git commit hash is good enough
// here; if git isn't available we fall back to a random UUID.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { url: "/offline", revision },
      // PWA launch page (manifest start_url) — must open instantly with zero
      // network, so it's precached exactly like the offline fallback.
      { url: "/launch", revision },
    ],
    swSrc: "app/sw.ts",
    // Use the native esbuild binary (faster than the WASM fallback).
    useNativeEsbuild: true,
  });