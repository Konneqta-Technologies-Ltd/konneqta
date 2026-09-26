/**
 * Shared FAQ content for the Konneqta landing page.
 *
 * Single source of truth so the visible FAQ (components/home/FaqSection.tsx,
 * a Client Component) and the FAQPage JSON-LD (emitted server-side from
 * app/(home)/page.tsx) can never drift apart — Google penalizes FAQ structured
 * data that doesn't match the on-page content.
 */

export type FaqItem = {
  q: string;
  a: string;
};

export const FAQS: FaqItem[] = [
  {
    q: 'What makes Konneqta different ?',
    a: 'Other tools just organize links. Konneqta helps you present your professional identity. It brings together your contact details, social profiles, portfolio, business information, and more into one trusted digital identity card that you can share anywhere. The app works offline',
  },
  {
    q: "Do I need an app to view someone's Konneqta card?",
    a: "No. Anyone can open a Konneqta card directly in their browser. There's nothing to install and no account is required to view a shared profile.",
  },
  {
    q: 'Who is Konneqta for?',
    a: 'Konneqta is built for professionals, freelancers, business owners, creators, job seekers, students, and organizations that want to present a trusted digital identity and make it easier for people to connect with them.',
  },
  {
    q: "What's the difference between the Free and Professional plans?",
    a: 'The Free plan gives you everything you need to create and share your digital identity card. Professional unlocks advanced customization, analytics, multiple identity cards, premium themes,  and additional tools designed to help you stand out.',
  },
  {
    q: 'Can I have more than one digital identity card?',
    a: 'Yes. Professional users can create multiple cards for different situations—for example, a work profile, a personal brand, or a business profile—while managing everything from one Konneqta account.',
  },
  {
    q: 'Can I choose what information people see?',
    a: 'Absolutely. You control what appears on your profile. You can update your details anytime and choose which information you want visible, helping you share confidently while protecting your privacy.',
  },
  {
    q: 'Why is QR code sharing important?',
    a: 'Instead of exchanging multiple usernames or contact details, one QR code instantly opens your complete professional profile. It makes networking faster, more memorable, and easier both online and in person.',
  },
  {
    q: 'Does Konneqta support businesses and teams?',
    a: "Yes. Businesses can create and manage digital identity cards for their employees from one dashboard. Teams can maintain consistent branding, verify staff, update employee information, and deactivate cards whenever someone leaves the organization. Though it's yet to be released",
  },
  {
    q: 'How do business accounts work?',
    a: 'Organizations subscribe based on the number of employees they manage. Each employee receives a branded Konneqta identity card, while administrators have access to centralized management, analytics, and company-wide controls.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your information belongs to you. You remain in control of your profile and can edit, update, or delete your information at any time. We also give you control over what information is shared with others.',
  },
  {
    q: 'Can I upgrade, downgrade, or cancel my plan?',
    a: 'Yes. You can change your subscription whenever you like. If you cancel a paid plan, your account simply returns to the Free plan at the end of your billing period.',
  },
  {
    q: 'Why should I have a Konneqta card?',
    a: 'Every day you share your phone number, LinkedIn, WhatsApp, portfolio, or website separately. Konneqta brings everything together into one trusted profile, making it easier for clients, employers, colleagues, and new connections to know who you are and how to reach you.',
  },
];
