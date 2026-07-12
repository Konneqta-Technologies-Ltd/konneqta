import Hero from '@/components/home/Hero';
import WhatIsSection from '@/components/home/WhatIsSection';
import CtaSection from '@/components/home/CtaSection';
import Footer from '@/components/home/Footer';
import Pricing from '@/components/home/Pricing';
import FaqSection from '@/components/home/FaqSection';

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
