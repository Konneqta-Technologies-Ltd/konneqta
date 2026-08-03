import CtaSection from '@/components/home/CtaSection';
import FaqSection from '@/components/home/FaqSection';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import type { Metadata } from 'next';
import Pricing from '@/components/home/Pricing';
import WhatIsSection from '@/components/home/WhatIsSection';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  // The landing page lives at /home (root "/" redirects here for anonymous
  // visitors). Self-canonical so Search Console attributes it correctly and
  // doesn't flag it as a duplicate of "/".
  alternates: { canonical: '/home' },
};

// force-dynamic: we read the Supabase session here so logged-in visitors see a
// "Go to my card" CTA instead of signup/login. getUser() refreshes cookies,
// which can't happen during a streaming RSC response.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Check if the visitor is logged in and, if so, resolve their card path +
  // first name so the Hero can show a personalized greeting.
  let cardPath: string | null = null;
  let firstName: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Resolve the user's active card (same logic as active-card-redirect,
      // kept inline to avoid a double getUser() round-trip).
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, active_card_id, status')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.status !== 'deactivated') {
        let slug: string | null = null;
        let fullName: string | null = null;

        if (profile.active_card_id) {
          const { data: card } = await supabase
            .from('cards')
            .select('slug, full_name')
            .eq('id', profile.active_card_id)
            .maybeSingle();
          slug = card?.slug ?? null;
          fullName = card?.full_name ?? null;
        }

        if (!slug) {
          const { data: primaryCard } = await supabase
            .from('cards')
            .select('slug, full_name')
            .eq('owner_id', user.id)
            .eq('is_primary', true)
            .maybeSingle();
          slug = primaryCard?.slug ?? profile.username;
          fullName ??= primaryCard?.full_name ?? null;
        }

        if (slug) {
          cardPath = `/${slug}`;
          // Extract the first name for the "Hi {firstName}" greeting.
          firstName = fullName?.trim().split(/\s+/)[0] ?? null;
        }
      }
    }
  } catch {
    // Auth resolution is best-effort: if Supabase is unreachable we simply
    // show the anonymous landing page (login/signup CTAs).
  }

  return (
    <main>
      <Hero cardPath={cardPath} firstName={firstName} />
      <WhatIsSection />
      <CtaSection />
      <Pricing />
      <FaqSection />
      <Footer />
    </main>
  );
}