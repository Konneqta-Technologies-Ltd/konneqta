import type { TourPopoverAlign, TourPopoverSide } from './onboardingSteps';

export interface VisitorTourStep {
  id: string;
  title: string;
  description: string;
  /** `data-tour` value of the element to spotlight. */
  target: string;
  /** Popover placement hint (driver.js auto-flips near viewport edges). */
  side?: TourPopoverSide;
  align?: TourPopoverAlign;
  /** Flip the card to its back before spotlighting. */
  flip?: boolean;
  /** Ensure the card shows its front before spotlighting. */
  unflip?: boolean;
  /** Only include when the owner has showcase items. */
  onlyWhenShowcase?: boolean;
}

/**
 * Tour for signed-out visitors viewing a public card. They see a different
 * button set than the owner (Save Contact, Connect, …) and everything lives
 * on one page, so there is no route navigation — just spotlighting.
 */
export const VISITOR_TOUR_STEPS: VisitorTourStep[] = [
  {
    id: 'flip-card',
    target: 'flip-card',
    side: 'bottom',
    title: 'This card flips',
    description:
      'Tap the circular button to flip the card over — the QR code and every link live on the back.',
  },
  {
    id: 'card-back',
    target: 'card-back',
    flip: true,
    side: 'bottom',
    title: 'Scan to connect',
    description:
      'Scan the QR with any phone camera, or tap a social link — no app needed to reach the owner.',
  },
  {
    id: 'save-contact',
    target: 'save-contact',
    unflip: true,
    title: 'Save to your phone',
    description:
      'One tap downloads the card as a contact — straight into your phone book.',
  },
  {
    id: 'connect',
    target: 'connect',
    title: 'Introduce yourself',
    description:
      'Send a Konneqt so the owner knows who you are and how to reach you back.',
  },
  {
    id: 'share-card',
    target: 'share-card',
    title: 'Pass it on',
    description: 'Share this card with anyone who should meet the owner.',
  },
  {
    id: 'copy-link',
    target: 'copy-link',
    title: 'Copy the link',
    description: 'Grab the card link to send it however you like.',
  },
  {
    id: 'showcase',
    target: 'showcase-trigger',
    onlyWhenShowcase: true,
    title: 'Browse the showcase',
    description:
      'Products and services from the owner — tap to browse them here.',
  },
];