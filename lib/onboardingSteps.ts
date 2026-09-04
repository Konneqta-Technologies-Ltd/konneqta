// lib/onboardingSteps.ts
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  route?: string;
  image?: string; // optional screenshot/illustration path
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'identity-card',
    target: 'owner-card',
    route: 'onboarding',
    title: 'Create your digital identity card',
    description:
      'Add your name, role, and links — this becomes your shareable Konneqta card.',
  },
  {
    id: 'customize-card',
    target: 'customize-card',
    route: 'profile',
    title: 'Customize your card',
    description:
      'Adjust your card appearance so it reflects your personal brand.',
  },
  {
    id: 'refresh-qr',
    target: 'refresh-qr',
    route: 'profile',
    title: 'Refresh your QR code',
    description: 'Generate a fresh QR code whenever you need one.',
  },
  {
    id: 'share-card',
    target: 'share-card',
    route: 'profile',
    title: 'Share your card',
    description: 'Share your Konneqta card directly from your profile.',
  },
  {
    id: 'copy-link',
    target: 'copy-link',
    route: 'profile',
    title: 'Copy your card link',
    description: 'Copy your card link and send it anywhere.',
  },
  {
    id: 'upgrade',
    target: 'upgrade',
    route: 'profile',
    title: 'Upgrade when you are ready',
    description: 'Unlock more Konneqta features with a Pro upgrade.',
  },
  {
    id: 'first-impression-score',
    target: 'analytics',
    route: 'analytics',
    title: 'Track your First Impression Score',
    description:
      'After upgrading, see how complete and engaging your card is, and level it up over time.',
  },
];
