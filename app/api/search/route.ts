/**
 * GET /api/search?q=<query>&page=<n> — profile search for LOGGED-IN users.
 *
 * Matches name / username / role / company (see lib/search.ts), ranked
 * closest-first. Returns up to SEARCH_PAGE_SIZE (15) results — one dropdown
 * page — plus `hasMore` so the UI can offer "See more results" → /search.
 *
 * AUTH: cookie-bearer session (same pattern as /api/konneqts). Anonymous
 * callers get 401 — search is an authenticated, in-app-only feature.
 *
 * Reads run under the CALLER's session (RLS public-read on cards/profiles
 * applies) — no service-role client needed for a read-only endpoint.
 */

import {
  SEARCH_MIN_QUERY_CHARS,
  SEARCH_PAGE_SIZE,
  sanitizeSearchQuery,
  searchProfiles,
} from "@/lib/search";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Hard cap on the page number (defensive — keeps offsets bounded). */
const MAX_PAGE = 50;

export async function GET(req: Request) {
  try {
    // 1. Verify the caller is authenticated via cookie-bearer JWT.
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
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Sign in to search profiles." },
        { status: 401 },
      );
    }

    // 2. Parse + sanitize the query. Too-short queries are not an error —
    //    the client simply hasn't typed enough yet.
    const { searchParams } = new URL(req.url);
    const q = sanitizeSearchQuery(searchParams.get("q") ?? "");
    if (q.length < SEARCH_MIN_QUERY_CHARS) {
      return NextResponse.json({ results: [], hasMore: false, page: 1 });
    }

    // 3. Page parameters (1-based).
    const page = Math.max(
      1,
      Math.min(
        MAX_PAGE,
        Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      ),
    );

    // 4. Search (shared logic with the /search page).
    const { results, hasMore } = await searchProfiles(supabase, {
      query: q,
      callerId: user.id,
      limit: SEARCH_PAGE_SIZE,
      offset: (page - 1) * SEARCH_PAGE_SIZE,
    });

    return NextResponse.json({ results, hasMore, page });
  } catch (err) {
    console.error("[api/search] error:", err);
    return NextResponse.json(
      { error: "Search is unavailable right now. Please try again." },
      { status: 500 },
    );
  }
}
