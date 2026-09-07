// lib/onboardingSteps.ts
export type TourPopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type TourPopoverAlign = 'start' | 'center' | 'end';

/**
 * Semantic destinations the tour can navigate to. OnboardingWidget resolves
 * these to real paths because only it knows the viewer's username/card state.
 */
export type TourRoute =
  | 'onboarding' // /onboarding (card creation)
  | 'profile' // /{username}
  | 'edit' // /{username}/edit
  | 'analytics' // /{username}/analytics
  | 'konneqts' // /{username}/konneqts
  | 'showcase' // /{username}/showcase
  | 'referral'; // /referral

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** `data-tour` value of the element to spotlight. */
  target?: string;
  /** Where the step lives. Defaults to 'profile'. */
  route?: TourRoute;
  /** Popover placement hint (driver.js auto-flips near viewport edges). */
  side?: TourPopoverSide;
  align?: TourPopoverAlign;
  /** Skip this step for Pro users (e.g. the upsell). */
  onlyWhenNotPro?: boolean;
  /** Flip the card to its back before spotlighting (QR context). */
  flip?: boolean;
  /** Flip back to the front before spotlighting. */
  unflip?: boolean;
}

/**
 * Owner product tour — a "maximize the app" journey: card basics first, then
 * the network (Konneqts), Showcase, analytics, referral and install. Ordered
 * by value, not by page.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'identity-card',
    target: 'owner-card',
    route: 'profile',
    title: 'Your digital identity card',
    description:
      'Everything about you on one shareable card — name, role, links. This is what people see when they scan your QR code.',
  },
  {
    id: 'flip-card',
    target: 'flip-card',
    route: 'profile',
    side: 'bottom',
    title: 'Your card flips',
    description:
      'Tap this button to flip the card over — your QR code and social links live on the back.',
  },
  {
    id: 'edit-card',
    target: 'edit-card',
    route: 'profile',
    title: 'Update your details anytime',
    description:
      'Name, role, links — everything about your card lives in this editor. It stays in sync everywhere, including your QR.',
  },
  {
    id: 'add-card',
    target: 'add-card',
    route: 'profile',
    title: 'Add another card',
    description:
      'Create separate cards for different sides of you — work, brand, personal. Multiple cards are a Pro feature.',
  },
  {
    id: 'customize-card',
    target: 'customize-card',
    route: 'profile',
    side: 'top',
    title: 'Make it yours',
    description:
      'Pick themes, colors and banners so the card matches your personal brand.',
  },
  {
    id: 'refresh-qr',
    target: 'refresh-qr',
    route: 'profile',
    flip: true,
    title: 'Keep your QR fresh',
    description:
      'The QR on the back points to this card forever. Generate a new one any time from this button.',
  },
  {
    id: 'share-card',
    target: 'share-card',
    route: 'profile',
    unflip: true,
    title: 'Share anywhere',
    description:
      'Send your card straight to WhatsApp, email or socials — one tap, no attachments.',
  },
  {
    id: 'copy-link',
    target: 'copy-link',
    route: 'profile',
    title: 'Copy your link',
    description:
      'konneqta.com/@you — drop it in your bio, email signature, anywhere.',
  },
  {
    id: 'upgrade',
    target: 'upgrade',
    route: 'profile',
    onlyWhenNotPro: true,
    title: 'Unlock Pro when you are ready',
    description:
      'Themes, banners, multiple cards and analytics — upgrade when you want to go further.',
  },
  {
    id: 'konneqts',
    target: 'konneqts',
    route: 'konneqts',
    title: 'Your network lives here',
    description:
      'Every person you connect with is saved as a Konneqt — an address book that builds itself.',
  },
  {
    id: 'showcase',
    target: 'showcase',
    route: 'showcase',
    title: 'Show what you do',
    description:
      'Add products or services to your Showcase so visitors can browse what you offer.',
  },
  {
    id: 'first-impression-score',
    target: 'analytics',
    route: 'analytics',
    title: 'Track your First Impression Score',
    description:
      'Views, scans and link clicks — see how your card performs and level it up over time.',
  },
  {
    id: 'referral',
    target: 'referral',
    route: 'referral',
    title: 'Refer & earn',
    description:
      'Share your code — every friend who subscribes earns you free Premium days.',
  },
  {
    id: 'install-app',
    target: 'app-menu',
    route: 'referral',
    side: 'right',
    title: 'Take Konneqta everywhere',
    description:
      'Open this menu any time and follow the instructions to install Konneqta on your phone — instant, offline access to your card.',
  },
];
