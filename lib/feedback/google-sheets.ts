/**
 * Google Sheets integration — sends feedback rows to a Google Apps Script Web App.
 *
 * WHY APPS SCRIPT (not the Sheets API directly)?
 *   The Sheets API requires OAuth + googleapis SDK (~big dependency) or a
 *   service account JSON. A deployed Apps Script Web App accepts a simple
 *   POST with no auth library — ideal for a side-channel data sink.
 *
 * SETUP (one-time, see scripts/google-sheets-feedback.gs):
 *   The SAME Apps Script Web App handles waitlist, contact AND feedback —
 *   it multiplexes them via a `sheet` field in the POST body.
 *   1. Create a Google Sheet with "Waitlist", "Contact", "Feedback" tabs.
 *   2. Extensions → Apps Script → paste the code from
 *      scripts/google-sheets-feedback.gs.
 *   3. Deploy → New deployment → Web app → "Anyone" access.
 *   4. Set GOOGLE_SCRIPT_URL in .env.local to the deployment URL (shared with
 *      the waitlist + contact routes).
 *
 * SECURITY
 *   This module is SERVER-ONLY. It reads GOOGLE_SCRIPT_URL (no
 *   NEXT_PUBLIC_ prefix) so the URL never reaches the browser. The fetch is
 *   fire-and-forget from the user's perspective: a Sheets outage returns a
 *   soft error, never a 500.
 */

export type FeedbackPayload = {
  feedbackId: string;
  timestamp: string;
  sentiment: "positive" | "neutral" | "negative";
  category: string;
  context: string;
  comment: string;
  rating: number | null;
  plan: string;
  engagementScore: number;
  shares: number;
  profileViews: number;
  qrScans: number;
  vcardDownloads: number;
  /** What feature the user was using, e.g. "profile_view". */
  featureBeingUsed: string;
  /** Approx session duration, e.g. "4m 23s". */
  sessionDuration: string;
  appVersion: string;
  browserOs: string;
  email: string;
};

/**
 * Generate a human-readable, searchable feedback ID.
 * Format: FB-YYYYMMDD-XXXX (4-char base36 from time + random).
 */
export function generateFeedbackId(): string {
  const d = new Date();
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const rand = (Date.now() % 36_000 + Math.floor(Math.random() * 36_000))
    .toString(36)
    .toUpperCase()
    .padStart(4, "0")
    .slice(-4);
  return `FB-${ymd}-${rand}`;
}

/**
 * POST a feedback payload to the Google Apps Script Web App.
 *
 * Returns true on success, false on any failure (non-fatal — the feedback is
 * still "submitted" from the user's perspective; the API route logs the error).
 */
export async function sendToGoogleSheets(
  payload: FeedbackPayload
): Promise<boolean> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) {
    console.warn(
      "[feedback] GOOGLE_SCRIPT_URL not set — feedback will not be stored."
    );
    return false;
  }

  try {
    // The shared Apps Script multiplexes waitlist / contact / feedback via a
    // `sheet` field. WITHOUT it the request falls through to the waitlist
    // handler, which rejects it ("Name and email are required.") because the
    // feedback payload has no `name`. So `sheet: "feedback"` is mandatory.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sheet: "feedback" }),
      // Don't let a slow Sheets script block the API response too long.
      signal: AbortSignal.timeout(10_000),
      // Apps Script web apps don't benefit from connection reuse.
      cache: "no-store",
    });

    // Apps Script returns its own { success } JSON in the body. `res.ok` alone
    // can be true even when the script reported a logical error (e.g. sheet
    // not found, or it fell through to the wrong handler). Read + log the body
    // so failures are diagnosable, and trust the script's `success` flag.
    const text = await res.text();
    console.log("[feedback] Google Script status:", res.status);
    console.log("[feedback] Google Script response:", text);

    let parsed: { success?: boolean } = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON body — treat as failure, but the log above tells us why.
    }

    return res.ok && parsed.success === true;
  } catch (err) {
    console.warn("[feedback] Google Sheets POST error (non-fatal):", err);
    return false;
  }
}