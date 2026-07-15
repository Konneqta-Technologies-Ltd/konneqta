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

// Account deletion touches storage, DB, and the Auth Admin API sequentially.
// Give the route plenty of headroom so a slow Supabase response can't abort
// the final (critical) auth-user deletion. (The route previously hit ~8.5s
// and failed on the auth call with AuthRetryableFetchError.)
export const maxDuration = 30;

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
    //
    //    BEST-EFFORT: orphaned storage files are harmless, but a failed auth
    //    deletion leaves a "ghost" user who can still sign in. So a storage
    //    error must NEVER abort the critical auth deletion below — wrap the
    //    whole block so any failure is logged and swallowed.
    const buckets = ["avatars", "logos", "qrcodes", "banners"];
    try {
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
    } catch (storageErr) {
      // Log and continue — do not let storage cleanup block account deletion.
      console.warn(
        "[delete-account] Storage cleanup failed (non-fatal):",
        storageErr
      );
    }

    // 4. Wipe the user's social_links + cards + profiles via the bulletproof
    //    RPC. The RPC runs in replica mode (triggers disabled), so the
    //    protect_primary_card() trigger cannot block the card deletion. This
    //    replaces the old Promise.all of raw deletes, which would abort the
    //    entire route (and skip the critical auth deletion) if any one delete
    //    threw.
    //
    //    FALLBACK: if the RPC doesn't exist yet (migration not run), fall back
    //    to the old raw deletes so the route keeps working in dev.
    const { error: rpcError } = await admin.rpc("delete_user_completely", {
      target_user_id: userId,
    });

    if (rpcError) {
      console.warn(
        "[delete-account] RPC failed, falling back to raw deletes:",
        rpcError.message
      );
      // Fallback: raw deletes (best-effort, individual try/catch so one
      // failure doesn't abort the others).
      await Promise.allSettled([
        admin.from("social_links").delete().eq("profile_id", userId),
        admin.from("cards").delete().eq("owner_id", userId),
        admin.from("profiles").delete().eq("id", userId),
      ]);
    }

    // 5. Delete the auth user entry. This is the irreversible step.
    //
    //    The Auth Admin API can throw `AuthRetryableFetchError` on transient
    //    network blips (timeout, socket reset, 5xx). Supabase marks these as
    //    retryable, so retry once with a short backoff before giving up.
    let lastError: unknown = null;
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (!error) {
          lastError = null;
          break; // success
        }
        lastError = error;
      } catch (fetchErr) {
        // Network-level failure (AuthRetryableFetchError, abort, etc.)
        lastError = fetchErr;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    if (lastError) {
      const e = lastError as {
        name?: string;
        message?: string;
        status?: number;
        cause?: unknown;
      };
      console.error("[delete-account] Failed to delete auth user:", {
        name: e?.name,
        message: e?.message,
        status: e?.status,
        cause: e?.cause,
        raw: lastError,
      });
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