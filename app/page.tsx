import CtaSection from '@/components/home/CtaSection';
import FaqSection from '@/components/home/FaqSection';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import type { Metadata } from 'next';
import Pricing from '@/components/home/Pricing';
import WhatIsSection from '@/components/home/WhatIsSection';
import { redirect } from 'next/navigation';
import { resolveActiveCardRedirect } from '@/lib/auth/active-card-redirect';

// force-dynamic: we read the Supabase session here to route logged-in users to
// their active card (and the getUser() call refreshes cookies, which can't
// happen during a streaming RSC response).
export const dynamic = 'force-dynamic';

// The landing page lives at the domain root ("/") — the single canonical URL
// for Konneqta. The old /home path 308-redirects here (next.config.ts) so
// existing links, bookmarks, and search equity consolidate onto "/".
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Root route = the PWA launch target (manifest start_url: "/").
// - Anonymous visitor → the landing page, rendered HERE (no redirect hop, so
//   Googlebot and first-time visitors get the content at the canonical "/")
// - Logged-in user  → their active card  (e.g. /john)
// - Logged-in, no profile yet → /onboarding
// - Deactivated user → /settings/deactivated
export default async function Page() {
  const resolution = await resolveActiveCardRedirect();

  if (resolution.status === 'card') redirect(resolution.path);
  if (resolution.status === 'onboard') redirect('/onboarding');
  if (resolution.status === 'deactivated') redirect('/settings/deactivated');

  // Anonymous (incl. crawlers) — render the landing page directly.
  return (
    <main>
      <Hero cardPath={null} firstName={null} />
      <WhatIsSection />
      <CtaSection />
      <Pricing />
      <FaqSection />
      <Footer />
    </main>
  );
}