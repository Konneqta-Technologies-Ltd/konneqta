import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// force-dynamic prevents Next.js 16 from streaming this page. The Supabase
// getUser() call refreshes session cookies, and setting cookies during a
// streaming RSC response triggers "controller[kState].transformAlgorithm
// is not a function" which corrupts the stream and bounces the user to /.
export const dynamic = 'force-dynamic';

export default async function PostLoginPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/');
    }

    // Get the profile — check if they have a card yet
    const { data: profile } = await supabase
        .from('profiles')
        .select('username, active_card_id')
        .eq('id', user.id)
        .maybeSingle();

    // No profile yet → first-time user → needs to onboard
    if (!profile) {
        redirect('/onboarding');
    }

    // If they have an active card, redirect to that card's slug.
    // NOTE: If the card is non-primary and Pro has expired, the [username]
    // page will redirect to the primary card. So we don't need expiry logic
    // here — just send them to their active card and let the page handle it.
    if (profile.active_card_id) {
        const { data: card } = await supabase
            .from('cards')
            .select('slug')
            .eq('id', profile.active_card_id)
            .maybeSingle();

        if (card) {
            redirect(`/${card.slug}`);
        }
    }

    // Fallback: no active card set, find their primary card
    const { data: primaryCard } = await supabase
        .from('cards')
        .select('slug')
        .eq('owner_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();

    if (primaryCard) {
        redirect(`/${primaryCard.slug}`);
    }

    // Last resort: use the username directly (shouldn't happen after migration)
    redirect(`/${profile.username}`);
}