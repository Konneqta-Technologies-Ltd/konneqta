/**
 * Shared notification types (client + server safe — no server-only imports).
 */

export const NOTIFICATION_TYPES = [
  'konneqt',
  'guest_konneqt',
  'referral',
  'pro_expiry',
  'weekly_digest',
  'share_limit',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** A row of the `notifications` table as consumed by the UI. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Human labels per type (used by Settings toggles). */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  konneqt: 'New Konneqts',
  guest_konneqt: 'Guest contact requests',
  referral: 'Referral rewards',
  pro_expiry: 'Pro expiry reminders',
  weekly_digest: 'Weekly summary',
  share_limit: 'Share limit warnings',
};
