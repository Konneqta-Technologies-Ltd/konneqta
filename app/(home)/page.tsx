import CtaSection from '@/components/home/CtaSection';
import FaqSection from '@/components/home/FaqSection';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import type { Metadata } from 'next';
import Pricing from '@/components/home/Pricing';
import WhatIsSection from '@/components/home/WhatIsSection';
import { redirect } from 'next/navigation';
import { resolveActiveCardRedirect } from '@/lib/auth/active-card-redirect';
import { FAQS } from '@/components/home/faq-data';
import {
  buildFaqSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
} from '@/lib/seo';

// force-dynamic: we read the Supabase session here to personalize the Hero CTA
// for signed-in users (and the getUser() call refreshes cookies, which can't
// happen during a streaming RSC response).
export const dynamic = 'force-dynamic';

// The landing page lives at the domain root ("/") — the single canonical URL
// for Konneqta. The old /home path 308-redirects here (next.config.ts) so
// existing links, bookmarks, and search equity consolidate onto "/".
//
// title.absolute: the brand is already in the title, so the root layout's
// "%s · Konneqta" template must not append it again. Keyword-first phrasing —
// the <title> is the strongest on-page SEO signal this page has.
export const metadata: Metadata = {
  title: { absolute: 'Digital Business Cards with QR Codes | Konneqta' },
  description:
    'Create your free digital business card with a QR code. Share all your links, socials, and contact details in one tap — online or offline.',
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

  // ── SEO: JSON-LD structured data ────────────────────────────────────────
  // Organization + WebSite give Google entity/knowledge-graph signals for the
  // brand; FAQPage mirrors the FAQ rendered by FaqSection from the SAME shared
  // array (components/home/faq-data.ts) so the structured data can never drift
  // from the visible content. Same <script> pattern as app/[username]/page.tsx.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.konneqta.com';
  const organizationSchema = buildOrganizationSchema({
    baseUrl,
    // Square brand icon (also the PWA 512 icon) — Google prefers a squarish
    // PNG for Organization logos.
    logoUrl: `${baseUrl}/icons/icon-512.png`,
    // Public support email shown on /contact — feeds the knowledge graph's
    // ContactPoint for the brand.
    contactEmail: 'info@konneqta.com',
  });
  const websiteSchema = buildWebsiteSchema({ baseUrl });
  const faqSchema = buildFaqSchema(FAQS);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Hero cardPath={cardPath} firstName={firstName} />
      <WhatIsSection />
      <CtaSection />
      <Pricing />
      <FaqSection />
      <Footer />
    </main>
  );
}