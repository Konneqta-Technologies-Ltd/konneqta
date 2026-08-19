import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * POST /api/onboarding/rollback — undo a half-created onboarding account.
 *
 * WHY THIS EXISTS
 * ---------------
 * Onboarding inserts the profile row FIRST and the primary card SECOND. If
 * the card insert fails (e.g. the historical cards_slug_format constraint
 * rejecting underscore usernames like "priceless_va"), the profile row was
 * already committed — leaving a "ghost" account:
 *   - /<username> 404s (the public page serves from `cards`, not `profiles`)
 *   - retrying onboarding fails with a duplicate-key error on username
 *   - the user is permanently stuck until support manually cleans up
 *
 * This route lets the form roll back cleanly: it deletes the caller's
 * profile row ONLY IF they have zero cards. That guard makes it safe:
 *   - It can never destroy a real account (real accounts have a primary
 *     card, protected by protect_primary_card() anyway).
 *   - It only ever removes the exact broken state this fixes.
 *
 * The delete uses the SERVICE ROLE key because profiles RLS may not grant
 * delete to the client. The service key is server-side only.
 *
 * Uploaded avatars/logos are left in storage on purpose: they're stored at
 * `<userId>/avatar.<ext>` and the retry uses `upsert: true` on the same
 * path, so they self-heal on the next attempt.
 */
export async function POST() {
  try {
    // 1. Verify the caller is authenticated via their cookie-bearer JWT.
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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized — no valid session." },
        { status: 401 }
      );
    }

    // 2. Admin client (service role — bypasses RLS, server-only key).
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. SAFETY GUARD: only roll back profiles with ZERO cards.
    //    A healthy account always has a primary card; this route must never
    //    be able to delete one.
    const { count, error: countError } = await admin
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    if (countError) {
      console.error("[onboarding/rollback] card count error:", countError.message);
      return NextResponse.json(
        { error: "Could not verify account state." },
        { status: 500 }
      );
    }

    if ((count ?? 0) > 0) {
      // Not a half-created account — refuse. (Shouldn't happen from the
      // form, but a replayed/malicious request must not wipe a real profile.)
      return NextResponse.json(
        { error: "Account has cards — rollback refused." },
        { status: 409 }
      );
    }

    // 4. Delete the orphaned profile row (frees the username for retry).
    //    No cards exist, so nothing cascades; social_links for a cardless
    //    profile can't exist either (they're card-scoped).
    const { error: deleteError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (deleteError) {
      console.error(
        "[onboarding/rollback] profile delete failed:",
        deleteError.message
      );
      return NextResponse.json(
        { error: "Rollback failed. Please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[onboarding/rollback] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}