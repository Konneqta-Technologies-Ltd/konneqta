import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Shared Supabase ADMIN client (service role).
 *
 * This bypasses RLS and is used for privileged operations that the anon key
 * cannot perform — e.g. looking up users by email, or updating a user's
 * password directly after an OTP-verified reset.
 *
 * SECURITY
 * --------
 * - `server-only` guarantees this never leaks to the browser.
 * - Uses `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) — never exposed
 *   to the client.
 * - `autoRefreshToken: false` + `persistSession: false` because this is a
 *   stateless server-side helper, not a user session.
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}