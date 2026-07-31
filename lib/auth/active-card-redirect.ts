import { createClient } from "@/lib/supabase/server";

/**
 * Resolves where an authenticated user should land based on their active card.
 *
 * Shared by the root entry route (`/`) and the post-login router (`/post-login`)
 * so both PWA launches and browser visits behave identically.
 *
 * Decision cascade:
 *   1. No session          → "anonymous"  (caller redirects to /waitlist)
 *   2. No profile row yet   → "onboard"    (caller redirects to /onboarding)
 *   3. status = 'deactivated' → "deactivated" (caller redirects to /settings/deactivated)
 *   4. profiles.active_card_id set  → that card's slug
 *   5. No active card → primary card  → that card's slug
 *   6. Last resort → username slug
 *
 * Note: we intentionally don't handle Pro expiry here. The [username] page
 * redirects a non-primary card to the primary when Pro has lapsed.
 */
export type ActiveCardResolution =
  | { status: "anonymous" }
  | { status: "onboard" }
  | { status: "deactivated" }
  | { status: "card"; path: string };

export async function resolveActiveCardRedirect(): Promise<ActiveCardResolution> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "anonymous" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, active_card_id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { status: "onboard" };
  }

  // Deactivated users are redirected to a calm reactivation page instead of
  // their (hidden) profile. Pre-migration (no status column) defaults to active.
  if (profile.status === "deactivated") {
    return { status: "deactivated" };
  }

  // Active card set → go straight to it.
  if (profile.active_card_id) {
    const { data: card } = await supabase
      .from("cards")
      .select("slug")
      .eq("id", profile.active_card_id)
      .maybeSingle();

    if (card) {
      return { status: "card", path: `/${card.slug}` };
    }
  }

  // No active card set → fall back to their primary card.
  const { data: primaryCard } = await supabase
    .from("cards")
    .select("slug")
    .eq("owner_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryCard) {
    return { status: "card", path: `/${primaryCard.slug}` };
  }

  // Last resort: use the username directly (shouldn't happen post-migration).
  return { status: "card", path: `/${profile.username}` };
}