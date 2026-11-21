import { NextRequest, NextResponse } from "next/server";

import { runProExpiryNotifications } from "@/lib/cron/pro-expiry";

export const dynamic = "force-dynamic";

/**
 * Daily Pro-expiry notification job (server-to-server).
 *
 * Sends the "Pro ends in 3 days" reminder and the "Pro has expired"
 * termination emails. Triggered once a day by a Render Cron Job:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<your-app>.onrender.com/api/cron/pro-expiry
 *
 * (cron-job.org with a custom Authorization header works identically.)
 *
 * SECURITY
 * --------
 * The endpoint requires `Authorization: Bearer <CRON_SECRET>` (server-side
 * env var, set in both the cron job's and the web service's environment).
 * Without the header the request is rejected — nobody can probe subscriber
 * emails or trigger repeat runs. The handler is also idempotent: the dedupe
 * columns on profiles mean a second run the same day sends nothing.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron/pro-expiry] CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron secret not configured." },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    console.warn("[cron/pro-expiry] Invalid or missing Authorization header.");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const summary = await runProExpiryNotifications();

  if (summary.failures.length > 0) {
    console.warn(
      "[cron/pro-expiry] Run completed with failures:",
      summary.failures
    );
  }

  return NextResponse.json({ success: true, ...summary });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}