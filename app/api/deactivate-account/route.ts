import { NextResponse } from "next/server";
import { captureEvent } from "@/lib/posthog";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/lib/supabase/request-auth";

/**
 * Account deactivation route handler.
 *
 * Deactivation is reversible: it hides the user's public profile, OG image,
 * vCard, and sitemap entry (they behave as if the account doesn't exist),
 * while preserving ALL data (cards, links, QR, subscription). The user stays
 * logged in and can reactivate at any time.
 *
 * Uses the service-role client to flip `profiles.status` to 'deactivated'
 * (bypasses any trigger/RLS friction, same pattern as /api/delete-account).
 *
 * Reactivation lives at /api/reactivate-account.
 */

export async function POST(request: Request) {
  try {
    // 1. Verify the caller — Bearer token (mobile) or SSR cookies (web).
    const { user } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized — no valid session." },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2. Flip status to 'deactivated' using the service-role key.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: updateError } = await admin
      .from("profiles")
      .update({ status: "deactivated" })
      .eq("id", userId);

    if (updateError) {
      console.error("[deactivate-account] DB update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate account. Please try again." },
        { status: 500 }
      );
    }

    // 3. Track the event (server-side).
    await captureEvent(userId, "account_deactivated");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[deactivate-account] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}