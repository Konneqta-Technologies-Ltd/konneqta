import TourHero from '@/components/tour/TourHero';
import StepSection from '@/components/tour/StepSection';
// import CtaSection from '@/components/CtaSection';

const steps = [
  {
    eyebrow: 'Step 1',
    title: 'Create your account',
    description:
      'Sign up in seconds with your email, or skip the form entirely with one-tap Google sign-in.',
    bullets: [
      'Email and password, or Google — your choice',
      'No long onboarding walls before you get started',
    ],
    images: [{ src: '/tour/01-signup.png', alt: 'Konneqta sign-up screen' }],
  },
  {
    eyebrow: 'Step 2',
    title: 'Tell us who you are',
    description:
      'Fill in your details once — your name, role, company, and links — and Konneqta turns it into a polished card.',
    bullets: [
      'Add your job title, company, and a short bio',
      'Phone number is optional and can stay hidden from your public card',
      'Add social and portfolio links with a click',
    ],
    images: [
      {
        src: '/tour/02-onboarding.png',
        alt: 'Onboarding a Konneqta profile card',
      },
    ],
  },
  {
    eyebrow: 'Step 3',
    title: 'Your card, ready to share',
    description:
      'Your profile becomes a clean, tappable card. Flip it to reveal your QR code — perfect for sharing in person, no typing required.',
    bullets: [
      'One tap flips between your profile and your QR code',
      'Free plan includes 25 shares a month, shown live at the top of your dashboard',
      'Resets automatically each month',
    ],
    images: [
      {
        src: '/tour/03-card-front.jpg',
        alt: 'Konneqta profile card front view',
      },
      {
        src: '/tour/04-card-qr.jpg',
        alt: 'Konneqta profile card QR code view',
      },
    ],
  },
  {
    eyebrow: 'Step 4',
    title: "Upgrade whenever you're ready",
    description:
      'When you outgrow the free plan, upgrading to Pro removes the share cap and unlocks custom themes, banners, and a branded QR code.',
    bullets: [
      'Switch between monthly and yearly billing — yearly saves 17%',
      'Pay by card or bank transfer, secured by Flutterwave',
      'Cancel anytime — your card never disappears',
    ],
    images: [
      {
        src: '/tour/05-upgrade-monthly.jpg',
        alt: 'Upgrade to Konneqta Pro, monthly billing',
      },
      {
        src: '/tour/06-upgrade-yearly.jpg',
        alt: 'Upgrade to Konneqta Pro, yearly billing',
      },
    ],
  },
];

export default function TourPage() {
  return (
    <main>
      <TourHero />
      <div className="bg-[#0a0a0a]">
        {steps.map((step, i) => (
          <StepSection key={step.title} index={i} {...step} />
        ))}
      </div>
      {/* <CtaSection /> */}
    </main>
  );
}
