import { NextResponse } from "next/server";
import { captureEvent } from "@/lib/posthog";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/lib/supabase/request-auth";

/**
 * Account reactivation route handler — the inverse of /api/deactivate-account.
 *
 * Flips `profiles.status` back to 'active', restoring the public profile,
 * OG image, vCard, and sitemap entry. All data was preserved during
 * deactivation, so there's nothing to restore — just the flag.
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

    // 2. Flip status back to 'active' using the service-role key.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: updateError } = await admin
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId);

    if (updateError) {
      console.error("[reactivate-account] DB update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to reactivate account. Please try again." },
        { status: 500 }
      );
    }

    // 3. Track the event (server-side).
    await captureEvent(userId, "account_reactivated");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reactivate-account] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}