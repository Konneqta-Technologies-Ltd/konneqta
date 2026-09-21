/**
 * Shared notification types (client + server safe — no server-only imports).
 */

export const NOTIFICATION_TYPES = [
  'konneqt',
  'konneqt_request',
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
  /**
   * Extra context stored in the row's jsonb column. For konneqt_request
   * rows it carries { requestId, requestStatus, requesterUsername } so the
   * panel can render Accept/Reject actions and settle them once resolved.
   */
  data?: Record<string, unknown> | null;
}

/** Lifecycle of a Konneqt (exchange-contact) request. */
export type KonneqtRequestStatus = 'pending' | 'accepted' | 'rejected';

/** Parsed `data` payload of a konneqt_request notification. */
export interface KonneqtRequestInfo {
  requestId: string;
  requestStatus: KonneqtRequestStatus;
  requesterUsername?: string;
}

/**
 * Extract the request context from a konneqt_request notification row.
 * Returns null for any other type (or malformed data) — callers render a
 * plain, non-actionable row in that case.
 */
export function getKonneqtRequestInfo(
  n: AppNotification,
): KonneqtRequestInfo | null {
  if (n.type !== 'konneqt_request') return null;
  const d = n.data;
  const requestId = typeof d?.requestId === 'string' ? d.requestId : null;
  if (!requestId) return null;
  const rawStatus = d?.requestStatus;
  const requestStatus: KonneqtRequestStatus =
    rawStatus === 'accepted' || rawStatus === 'rejected'
      ? rawStatus
      : 'pending';
  const requesterUsername =
    typeof d?.requesterUsername === 'string' ? d.requesterUsername : undefined;
  return { requestId, requestStatus, requesterUsername };
}

/** Human labels per type (used by Settings toggles). */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  konneqt: 'New Konneqts',
  konneqt_request: 'Konneqt requests',
  guest_konneqt: 'Guest contact requests',
  referral: 'Referral rewards',
  pro_expiry: 'Pro expiry reminders',
  weekly_digest: 'Weekly summary',
  share_limit: 'Share limit warnings',
};
