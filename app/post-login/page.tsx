import { redirect } from 'next/navigation';
import { resolveActiveCardRedirect } from '@/lib/auth/active-card-redirect';

// force-dynamic prevents Next.js 16 from streaming this page. The Supabase
// getUser() call refreshes session cookies, and setting cookies during a
// streaming RSC response triggers "controller[kState].transformAlgorithm
// is not a function" which corrupts the stream and bounces the user to /.
export const dynamic = 'force-dynamic';

// Reached after a successful auth callback. Routes the user to their active
// card. Shares the same resolution logic as the root route so PWA launches
// and post-login landings behave identically.
export default async function PostLoginPage() {
    const resolution = await resolveActiveCardRedirect();

    switch (resolution.status) {
        case 'anonymous':
            redirect('/');
        case 'onboard':
            redirect('/onboarding');
        case 'deactivated':
            // Deactivated users land on a calm reactivation page, not their
            // (hidden) profile.
            redirect('/settings/deactivated');
        case 'card':
            redirect(resolution.path);
    }
}