/**
 * Profile search — shared logic for the logged-in "find people" feature.
 *
 * Surfaces:
 *   1. GET /api/search — live dropdown in the navbar (page 1, 15 results)
 *   2. /search         — full results page (paginated, 15 per page)
 *
 * MATCHES across four fields: cards.full_name / cards.job_title /
 * cards.company (display data has lived on cards since Phase 4) and
 * profiles.username (the account handle). Case-insensitive substring via
 * PostgREST `ilike`, ranked closest-match-first (exact handle → handle
 * prefix → name prefix → role/company prefix → any substring).
 *
 * EXCLUSIONS:
 *   - the caller themselves (you don't need to search for you)
 *   - deactivated accounts (they behave as if they don't exist)
 *   - `is_searchable = false` cards are NOT excluded — that flag opts a card
 *     out of search ENGINES (robots meta), not out of in-app discovery.
 *
 * IMPLEMENTATION NOTE: two ilike candidate queries (cards + profiles) are
 * merged, deduped and ranked in JS within a bounded candidate window.
 * Instant at current scale; the upgrade path if the user base grows is a
 * Postgres RPC with pg_trgm indexes (supabase/profile-search.sql).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Results per page — the dropdown and the /search page agree on this. */
export const SEARCH_PAGE_SIZE = 15;
export const SEARCH_MIN_QUERY_CHARS = 2;
export const SEARCH_MAX_QUERY_CHARS = 60;

/**
 * Candidate window per source query. Bounded so behaviour stays predictable;
 * large enough for 20+ pages of merged, deduped results.
 */
const CANDIDATE_LIMIT = 400;

export type ProfileSearchResult = {
  /** profiles.username — the account handle (lowercase by convention). */
  username: string;
  /** Public profile path segment — the card slug to link to (`/{slug}`). */
  slug: string;
  fullName: string | null;
  jobTitle: string | null;
  company: string | null;
  avatarUrl: string | null;
};

/**
 * Clean raw user input for searching.
 *
 * - trims, drops a leading `@` (people type handles with it)
 * - collapses whitespace
 * - strips characters that are either PostgREST `.or()` separators
 *   (commas / parentheses / quotes) or `ilike` wildcards (`%` `_` `\`) so the
 *   pattern is always a LITERAL substring — this also stops `%`-only input
 *   from scanning whole tables.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[%_\\(),'"]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, SEARCH_MAX_QUERY_CHARS);
}

/** Closeness rank — lower is closer. Exact handle wins, then prefixes. */
function rankMatch(
  q: string,
  r: Pick<ProfileSearchResult, "username" | "fullName" | "jobTitle" | "company">,
): number {
  const needle = q.toLowerCase();
  const username = r.username.toLowerCase();
  if (username === needle) return 0;
  if (username.startsWith(needle)) return 1;
  if ((r.fullName ?? "").toLowerCase().startsWith(needle)) return 2;
  const role = (r.jobTitle ?? "").toLowerCase();
  const company = (r.company ?? "").toLowerCase();
  if (role.startsWith(needle) || company.startsWith(needle)) return 3;
  return 4;
}

type CardRow = {
  id: string;
  owner_id: string;
  slug: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  avatar_url: string | null;
  is_primary: boolean;
};

type ProfileRow = {
  id: string;
  username: string;
  status: string | null;
  active_card_id: string | null;
};

/** `status` filter that also keeps NULL rows (pre-migration profiles). */
const NOT_DEACTIVATED = "status.neq.deactivated,status.is.null";

/** Pick the card to SHOW for an owner: active → primary → first matched. */
function pickCard(cards: CardRow[], activeCardId: string | null): CardRow {
  return (
    (activeCardId ? cards.find((c) => c.id === activeCardId) : undefined) ??
    cards.find((c) => c.is_primary) ??
    cards[0]
  );
}

/**
 * Search profiles by name, username, role or company.
 *
 * Runs under the caller's own Supabase session (RLS public-read on
 * `cards`/`profiles` applies) — no service-role client needed.
 *
 * Returns one page of ranked results plus `hasMore` (more matches exist
 * beyond this page within the candidate window).
 */
export async function searchProfiles(
  supabase: SupabaseClient,
  opts: {
    query: string;
    /** The searching user — excluded from their own results. */
    callerId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ results: ProfileSearchResult[]; hasMore: boolean }> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? SEARCH_PAGE_SIZE));
  const offset = Math.max(0, opts.offset ?? 0);
  const q = sanitizeSearchQuery(opts.query);

  if (q.length < SEARCH_MIN_QUERY_CHARS) {
    return { results: [], hasMore: false };
  }

  const cardFields =
    "id, owner_id, slug, full_name, job_title, company, avatar_url, is_primary";
  const profileFields = "id, username, status, active_card_id";
  const pattern = `%${q}%`;

  // ── Two independent candidate searches, in parallel ────────────────────
  const [cardMatches, usernameMatches] = await Promise.all([
    // A) Display-data matches: name / role / company (all live on cards).
    supabase
      .from("cards")
      .select(cardFields)
      .or(
        `full_name.ilike.${pattern},job_title.ilike.${pattern},company.ilike.${pattern}`,
      )
      .limit(CANDIDATE_LIMIT),
    // B) Handle matches: username (on profiles), deactivated excluded.
    supabase
      .from("profiles")
      .select(profileFields)
      .or(NOT_DEACTIVATED)
      .ilike("username", pattern)
      .limit(CANDIDATE_LIMIT),
  ]);

  const cardsA = (cardMatches.data ?? []) as CardRow[];
  const profilesB = (usernameMatches.data ?? []) as ProfileRow[];

  // ── Resolve the owners behind the card matches (status/handle/active) ──
  const ownerProfiles = new Map<string, ProfileRow>();
  const ownerIds = [...new Set(cardsA.map((c) => c.owner_id))];
  if (ownerIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select(profileFields)
      .in("id", ownerIds);
    for (const p of (data ?? []) as ProfileRow[]) ownerProfiles.set(p.id, p);
  }
  // Username matches already carry their own profile row.
  for (const p of profilesB) ownerProfiles.set(p.id, p);

  // Group matched cards per owner (Query A).
  const cardsByOwner = new Map<string, CardRow[]>();
  for (const c of cardsA) {
    const list = cardsByOwner.get(c.owner_id) ?? [];
    list.push(c);
    cardsByOwner.set(c.owner_id, list);
  }

  // ── Display cards for username matches with no card-field hit yet ──────
  const needsCard = profilesB.filter(
    (p) =>
      p.id !== opts.callerId &&
      p.status !== "deactivated" &&
      !cardsByOwner.has(p.id),
  );
  const resolvedCards = new Map<string, CardRow>(); // owner_id → card
  if (needsCard.length > 0) {
    const activeIds = needsCard
      .map((p) => p.active_card_id)
      .filter((id): id is string => !!id);
    const noActiveOwnerIds = needsCard
      .filter((p) => !p.active_card_id)
      .map((p) => p.id);

    // Active cards for users that have one; primary cards for the rest.
    const fetches: PromiseLike<{ data: CardRow[] | null }>[] = [];
    if (activeIds.length > 0) {
      fetches.push(
        supabase.from("cards").select(cardFields).in("id", activeIds),
      );
    }
    if (noActiveOwnerIds.length > 0) {
      fetches.push(
        supabase
          .from("cards")
          .select(cardFields)
          .in("owner_id", noActiveOwnerIds)
          .eq("is_primary", true),
      );
    }
    const fetched = await Promise.all(fetches);
    for (const res of fetched) {
      for (const c of (res.data ?? []) as CardRow[]) {
        if (!resolvedCards.has(c.owner_id)) resolvedCards.set(c.owner_id, c);
      }
    }
  }

  // ── Merge: one entry per owner, exclusions applied ─────────────────────
  const entries = new Map<string, { profile: ProfileRow; card: CardRow }>();

  for (const [ownerId, cards] of cardsByOwner) {
    const profile = ownerProfiles.get(ownerId);
    if (!profile) continue;
    if (profile.status === "deactivated") continue;
    if (profile.id === opts.callerId) continue;
    entries.set(ownerId, {
      profile,
      card: pickCard(cards, profile.active_card_id),
    });
  }

  for (const p of needsCard) {
    const card = resolvedCards.get(p.id);
    if (!card) continue; // no card to link to — nothing to show
    entries.set(p.id, { profile: p, card });
  }

  // ── Rank (closest first), then slice the requested page ────────────────
  const all: ProfileSearchResult[] = [...entries.values()].map(
    ({ profile, card }) => ({
      username: profile.username,
      slug: card.slug,
      fullName: card.full_name,
      jobTitle: card.job_title,
      company: card.company,
      avatarUrl: card.avatar_url,
    }),
  );

  all.sort((a, b) => {
    const ra = rankMatch(q, a);
    const rb = rankMatch(q, b);
    if (ra !== rb) return ra - rb;
    return a.username.localeCompare(b.username);
  });

  return {
    results: all.slice(offset, offset + limit),
    hasMore: all.length > offset + limit,
  };
}
