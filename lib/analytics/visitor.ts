/**
 * Anonymous visitor identity via a first-party cookie.
 *
 * A stable `kq_vid` (Konneqta Visitor ID) uuid is set on the first request and
 * persists for a year. This powers unique-visitor and returning-visitor counts
 * WITHOUT requiring login and WITHOUT storing any PII — it's just a random id.
 *
 * Why a cookie and not localStorage?
 *   - Server components / route handlers can read it directly (localStorage is
 *     browser-only), so we can attribute profile views server-side.
 *   - It survives across subdomains / devices only if scoped to the domain,
 *     but that's fine — we want per-device uniqueness to be "good enough."
 */

import { cookies } from "next/headers";

export const VISITOR_COOKIE_NAME = "kq_vid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Read the visitor id from the cookie store, or generate a new one and set it.
 * Returns the id so the caller can attach it to an analytics event.
 *
 * IMPORTANT: This writes a cookie, so it can ONLY be called from a
 * Route Handler or a Server Action. It CANNOT be called from a Server
 * Component (a page.tsx or layout.tsx) — Next.js will throw:
 * "Cookies can only be modified in a Server Action or Route Handler."
 *
 * The visitor cookie is now set centrally by the middleware (proxy.ts),
 * so Server Components should use the read-only getVisitorId() instead.
 * This function is retained for Route Handlers / Server Actions that need
 * to ensure the cookie exists (e.g. when running outside the middleware
 * matcher).
 */
export async function getOrCreateVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_COOKIE_NAME)?.value;

  if (existing) return existing;

  // Generate a fresh uuid (crypto.randomUUID is available on Node 19+/Edge).
  const newId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  cookieStore.set(VISITOR_COOKIE_NAME, newId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  return newId;
}

/**
 * Read-only visitor id (null if unset). Use when you don't want to set a cookie
 * (e.g. in a non-rendering context). Most callers should use getOrCreate.
 */
export async function getVisitorId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? null;
}