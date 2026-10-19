import { cookies } from "next/headers";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Shared API auth — accepts BOTH client types:
 *
 * 1. Bearer token in the Authorization header — the Konneqta MOBILE app.
 *    (Same pattern as /api/onboarding/generate-qr, which was built for the
 *    mobile client because native has no SSR cookies.)
 * 2. SSR session cookies — the web browser (existing behaviour, unchanged).
 *
 * Returns the user-bound Supabase client (RLS applies as the caller) plus the
 * resolved user (null when unauthenticated). Route handlers keep deciding
 * their own 401 response, exactly as before — this helper changes nothing
 * about what each route is allowed to do.
 */
export async function getUserFromRequest(
  request: Request
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    // Mobile client acts as the caller — ownership checks + RLS apply normally.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user: user ?? null };
  }

  // Web browser — verify via the SSR cookie session.
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user: user ?? null };
}