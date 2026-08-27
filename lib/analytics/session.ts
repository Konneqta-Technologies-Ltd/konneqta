/**
 * Anonymous visit sessions (30-minute sliding window).
 *
 * The `kq_sid` cookie is created and refreshed by the proxy (middleware) on
 * every page request with a 30-minute max-age. Each new request slides the
 * expiry forward, so a session survives as long as the visitor keeps
 * interacting; after 30 minutes of inactivity the cookie expires and the
 * next visit starts a NEW session.
 *
 * Combined with the long-lived `kq_vid` visitor cookie this gives us:
 *   • unique visitors  → count(distinct visitor_id)
 *   • returning        → visitors with more than one distinct session_id
 *   • duplicate-proof views → one profile_view per visitor per session
 *
 * No PII — both values are random UUIDs. Like kq_vid, the cookie is only set
 * after cookie consent is accepted (see proxy.ts).
 */

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "kq_sid";
/** Standard analytics inactivity window (matches GA/PostHog defaults). */
export const SESSION_WINDOW_SECONDS = 30 * 60;

/**
 * Read-only session id (null when cookies are absent — e.g. pre-consent
 * visitors, or direct API hits that bypass the proxy).
 */
export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
