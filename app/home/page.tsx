import CtaSection from '@/components/home/CtaSection';
import FaqSection from '@/components/home/FaqSection';
import Footer from '@/components/home/Footer';
import Hero from '@/components/home/Hero';
import type { Metadata } from 'next';
import Pricing from '@/components/home/Pricing';
import WhatIsSection from '@/components/home/WhatIsSection';

export const metadata: Metadata = {
  // The landing page lives at /home (root "/" redirects here for anonymous
  // visitors). Self-canonical so Search Console attributes it correctly and
  // doesn't flag it as a duplicate of "/".
  alternates: { canonical: '/home' },
};

export default function Home() {
  return (
    <main>
      <Hero />
      <WhatIsSection />
      <CtaSection />
      <Pricing />
      <FaqSection />
      <Footer />
    </main>
  );
}