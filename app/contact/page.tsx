import ContactForm from '@/components/contact/ContactForm';
import Footer from '@/components/home/Footer';

export const metadata = {
  title: 'Contact Us',
  // ~118 chars — inside the 110–160 SEO sweet spot (was a thin 36 chars).
  description:
    'Questions, feedback, or partnership ideas? Reach the Konneqta team through the contact form or email info@konneqta.com.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main>
      <ContactForm />
      <Footer />
    </main>
  );
}