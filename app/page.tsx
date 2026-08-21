import CtaSection from '@/components/home/CtaSection';
import FaqSection from '@/components/home/FaqSection';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import type { Metadata } from 'next';
import Pricing from '@/components/home/Pricing';
import WhatIsSection from '@/components/home/WhatIsSection';
import { redirect } from 'next/navigation';
import { resolveActiveCardRedirect } from '@/lib/auth/active-card-redirect';

// force-dynamic: we read the Supabase session here to personalize the Hero CTA
// for signed-in users (and the getUser() call refreshes cookies, which can't
// happen during a streaming RSC response).
export const dynamic = 'force-dynamic';

// The landing page lives at the domain root ("/") — the single canonical URL
// for Konneqta. The old /home path 308-redirects here (next.config.ts) so
// existing links, bookmarks, and search equity consolidate onto "/".
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Root route = the landing page, ALWAYS rendered here for every visitor.
// - Anonymous visitor → generic landing page (no redirect hop, so Googlebot
//   and first-time visitors get the content at the canonical "/")
// - Logged-in user  → same landing page, but the Hero CTA is personalized
//   ("Hi, {name}" → their active card) instead of redirecting them away.
// - Logged-in, no profile yet → /onboarding
// - Deactivated user → /settings/deactivated
//
// The SideNav "Home" link points here, so signed-in users must be able to
// reach the landing page from the menu. PWA launches still land on the
// user's card via manifest start_url: "/post-login".
export default async function Page() {
  const resolution = await resolveActiveCardRedirect();

  if (resolution.status === 'onboard') redirect('/onboarding');
  if (resolution.status === 'deactivated') redirect('/settings/deactivated');

  // Anonymous (incl. crawlers) OR signed-in with an active card — render the
  // landing page directly, personalizing the Hero CTA for signed-in users.
  const cardPath = resolution.status === 'card' ? resolution.path : null;
  const firstName =
    resolution.status === 'card' && resolution.name
      ? resolution.name.split(' ')[0]
      : null;

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