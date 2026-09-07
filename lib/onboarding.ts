import { createClient } from '@/lib/supabase/client';

export const PRODUCT_TOUR_KEY = 'main';
// v2 — driver.js rework: anchored popovers, flip-card step, Konneqts/Showcase/
// Referral coverage + a separate visitor tour. Bumping re-offers the improved
// tour once to users who already completed v1.
export const PRODUCT_TOUR_VERSION = 2;
export const OPEN_PRODUCT_TOUR_EVENT = 'konneqta:open-product-tour';
// Fired by the "?" help button on a public card page (visitors have no
// sidenav, so the replay entry point lives next to the card actions).
export const OPEN_VISITOR_TOUR_EVENT = 'konneqta:open-visitor-tour';
// Tour → ProfileCard: flip the card. detail.flipped = true → back, false → front.
export const FLIP_CARD_EVENT = 'konneqta:flip-card';

// Visitor tour state is per-browser (no account to persist against), so it
// lives in localStorage. The key is versioned — bump it to re-offer the tour.
const VISITOR_TOUR_STORAGE_KEY = 'konneqta:visitor-tour:v1';

export async function hasSeenProductTour(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profile_tours')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('tour_key', PRODUCT_TOUR_KEY)
    .eq('version', PRODUCT_TOUR_VERSION)
    .maybeSingle();

  // Do not interrupt a user when the optional tour state cannot be read.
  if (error) return true;
  if (!data) return false;
  return Boolean(data.completed_at);
}

export async function markProductTourSeen(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('profile_tours').upsert(
    {
      user_id: userId,
      tour_key: PRODUCT_TOUR_KEY,
      version: PRODUCT_TOUR_VERSION,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,tour_key,version' },
  );
}

/** Visitor tour seen flag — localStorage, safe during SSR and private mode. */
export function hasSeenVisitorTour(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(VISITOR_TOUR_STORAGE_KEY) === 'seen';
  } catch {
    // Storage unavailable — treat as seen so we never trap the visitor.
    return true;
  }
}

export function markVisitorTourSeen(): void {
  try {
    window.localStorage.setItem(VISITOR_TOUR_STORAGE_KEY, 'seen');
  } catch {
    // Private mode etc. — the tour may re-offer; harmless.
  }
}

/** Ask the ProfileCard on the page to flip (or unflip). No-op when absent. */
export function requestCardFlip(flipped: boolean): void {
  window.dispatchEvent(
    new CustomEvent(FLIP_CARD_EVENT, { detail: { flipped } }),
  );
}
