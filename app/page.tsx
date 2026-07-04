import Hero from '@/components/home/Hero';
import WhatIsSection from '@/components/home/WhatIsSection';
import CtaSection from '@/components/home/CtaSection';
import Footer from '@/components/home/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <WhatIsSection />
      <CtaSection />
      <Footer />
    </main>
  );
}
