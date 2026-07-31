import { NextResponse } from "next/server";
import { captureEvent } from "@/lib/posthog";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Account reactivation route handler — the inverse of /api/deactivate-account.
 *
 * Flips `profiles.status` back to 'active', restoring the public profile,
 * OG image, vCard, and sitemap entry. All data was preserved during
 * deactivation, so there's nothing to restore — just the flag.
 */

export async function POST() {
  try {
    const cookieStore = await cookies();

    // 1. Verify the caller is authenticated via cookie-bearer JWT.
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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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