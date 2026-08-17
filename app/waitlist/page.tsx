import Footer from '@/components/home/Footer';
import type { Metadata } from 'next';
import WaitlistHero from '@/components/waitlist/WaitListHero';

export const metadata: Metadata = {
  title: 'Join the Konneqta Waitlist',
  description:
    'Be first in line when Konneqta opens — get your digital business card with every social link in one place.',
  // Self-canonical: /waitlist is a distinct, indexable page. Without this it
  // inherited the root layout canonical and Google flagged it as a duplicate
  // of "/" ("Google chose different canonical than user").
  alternates: { canonical: '/waitlist' },
};

export default function WaitlistPage() {
  return (
    <main>
      <WaitlistHero />
      <Footer />
    </main>
  );
}
