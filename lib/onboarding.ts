import { createClient } from '@/lib/supabase/client';

export const PRODUCT_TOUR_KEY = 'main';
export const PRODUCT_TOUR_VERSION = 1;
export const OPEN_PRODUCT_TOUR_EVENT = 'konneqta:open-product-tour';

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
