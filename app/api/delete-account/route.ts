import { NextResponse } from "next/server";
import { captureEvent } from "@/lib/posthog";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Account deletion route handler.
 *
 * Supabase's browser SDK cannot delete auth accounts — only the service role
 * key can. This route runs server-side, verifies the caller's identity via
 * their auth cookie, then uses the service role key to wipe:
 *   1. Storage files (avatars, logos, qrcodes) for the user's folder.
 *   2. The auth.users entry (cascades to profiles + social_links if FK
 *      ON DELETE CASCADE is set; otherwise rows are deleted manually first).
 *
 * Security: the SUPABASE_SERVICE_ROLE_KEY is read from the server environment
 * and is NEVER exposed to the browser (no NEXT_PUBLIC_ prefix).
 */
export async function POST() {
  try {
    const cookieStore = await cookies();

    // 1. Verify the caller is authenticated using their cookie-bearer JWT.
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

    // 2. Create an admin client with the service role key (server-only).
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. Wipe storage files for this user across all buckets.
    //    Files are stored under `<userId>/...` paths.
    //    QR codes for multi-card are stored under `<userId>/<cardId>/qr.png`.
    const buckets = ["avatars", "logos", "qrcodes", "banners"];
    for (const bucket of buckets) {
      const { data: folders } = await admin.storage
        .from(bucket)
        .list(userId, { limit: 100 });

      if (folders && folders.length > 0) {
        // Collect all files (may include subfolders for qrcodes)
        const allPaths: string[] = [];
        for (const item of folders) {
          const itemPath = `${userId}/${item.name}`;
          if (item.id) {
            // It's a folder (e.g. qrcodes has per-card subfolders)
            const { data: subFiles } = await admin.storage
              .from(bucket)
              .list(itemPath, { limit: 100 });
            if (subFiles) {
              for (const sub of subFiles) {
                allPaths.push(`${itemPath}/${sub.name}`);
              }
            }
          } else {
            // It's a file directly under the user folder
            allPaths.push(itemPath);
          }
        }
        if (allPaths.length > 0) {
          await admin.storage.from(bucket).remove(allPaths);
        }
      }
    }

    // 4. Delete cards + social_links + profiles rows manually (defence-in-depth
    //    in case ON DELETE CASCADE isn't wired up in the DB).
    //    Cards must go first (social_links reference card_id), then profile.
    await admin.from("social_links").delete().eq("profile_id", userId);
    await admin.from("cards").delete().eq("owner_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // 5. Delete the auth user entry. This is the irreversible step.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-account] Failed to delete auth user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account. Please try again." },
        { status: 500 }
      );
    }

    // 6. Track the deletion event (server-side).
    await captureEvent(userId, "account_deleted");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}