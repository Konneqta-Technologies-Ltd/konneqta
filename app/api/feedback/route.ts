/**
 * POST /api/feedback — submit feedback to Google Sheets + record submission.
 *
 * Body: {
 *   sentiment, category, context, comment, featureBeingUsed,
 *   sessionDuration, rating (optional)
 * }
 *
 * Flow:
 *   1. Auth-check the caller.
 *   2. Gather engagement metrics (shares/views/scans/downloads) for context.
 *   3. Generate a feedback ID (FB-YYYYMMDD-XXXX).
 *   4. POST the payload to Google Sheets via the Apps Script Web App.
 *   5. Set feedback_last_submitted_at = now on the user's profile.
 *   6. Return the feedback ID (shown to the user as their reference).
 *
 * SECURITY
 *   The Sheets URL is server-only (GOOGLE_SCRIPT_URL). The user's
 *   email is included for follow-up but never exposed to the browser.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getTotals } from "@/lib/analytics/queries";
import { computeScore } from "@/lib/feedback/score";
import { sendFeedbackEmails } from "@/lib/emails/zeptomail";
import {
  generateFeedbackId,
  sendToGoogleSheets,
  type FeedbackPayload,
} from "@/lib/feedback/google-sheets";
import { isPro } from "@/lib/entitlements";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // --- Auth --------------------------------------------------------------
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // --- Fetch profile for context -----------------------------------------
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, username, plan, is_exempt, pro_expires_at, feedback_milestones, created_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    // --- Gather engagement metrics (all-time) ------------------------------
    // Use the user-bound client (RLS will scope to their own events).
    const totals = await getTotals(supabase, user.id, 9999);
    const score = computeScore(
      profile?.feedback_milestones ?? 0,
      profile?.created_at ?? null
    );

    // --- Build the payload -------------------------------------------------
    const feedbackId = generateFeedbackId();
    const sentiment = ["positive", "neutral", "negative"].includes(
      body.sentiment
    )
      ? body.sentiment
      : "neutral";

    const payload: FeedbackPayload = {
      feedbackId,
      timestamp: new Date().toISOString(),
      sentiment: sentiment as FeedbackPayload["sentiment"],
      category: String(body.category ?? ""),
      context: String(body.context ?? ""),
      comment: String(body.comment ?? ""),
      rating:
        typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
          ? body.rating
          : null,
      plan: isPro(profile) ? "pro" : (profile?.plan ?? "free"),
      engagementScore: score,
      shares: totals.shares,
      profileViews: totals.views,
      qrScans: totals.qrScans,
      vcardDownloads: totals.vcardDownloads,
      featureBeingUsed: String(body.featureBeingUsed ?? "unknown"),
      sessionDuration: String(body.sessionDuration ?? ""),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      browserOs: String(body.browserOs ?? ""),
      email: user.email ?? "",
    };

    // --- Send to Google Sheets (non-blocking on success) -------------------
    // We don't fail the whole request if Sheets is down — the user still gets
    // their feedback ID and their submission timestamp is recorded. The error
    // is logged server-side for ops to catch. sendToGoogleSheets() now reads &
    // logs the Apps Script response body, so check the returned boolean here
    // to flag logical failures (e.g. wrong sheet, missing header) clearly.
    const sheetsOk = await sendToGoogleSheets(payload);
    if (!sheetsOk) {
      console.warn(
        `[api/feedback] Google Sheets write failed for feedback ${feedbackId}. ` +
          "See [feedback] logs above for the Apps Script response."
      );
    }

    // --- Record submission timestamp ---------------------------------------
    // Uses the RPC-free UPDATE (users can update their own profile row).
    await supabase
      .from("profiles")
      .update({
        feedback_last_submitted_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // --- Emails (best-effort — never fail the submission) -------------------
    // Confirmation to the user (with their reference ID) + alert to the
    // admin inbox. sendFeedbackEmails logs its own failures internally.
    await sendFeedbackEmails(
      {
        feedbackId,
        email: user.email ?? "",
        sentiment: payload.sentiment,
        comment: payload.comment,
        date: payload.timestamp,
      },
      payload
    );

    return NextResponse.json({ ok: true, feedbackId });
  } catch (err) {
    console.error("[api/feedback] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}