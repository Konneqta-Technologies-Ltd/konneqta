import ContactForm from '@/components/contact/ContactForm';
import Footer from '@/components/home/Footer';

export const metadata = {
  title: 'Contact Us - Konneqta',
  description: 'Get in touch with the Konneqta team.',
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