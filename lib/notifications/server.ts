/**
 * Notification creation engine (server-only).
 *
 * ONE call per business event. It:
 *   1. Checks the user's notification_preferences (missing row = all on).
 *   2. Inserts the in-app row (bell / dropdown / /notifications page).
 *   3. Sends a Web Push to every device subscription (best-effort).
 *
 * The whole function is non-fatal by design — a notification failure can
 * NEVER break the user action that triggered it (Konneqt, share, payment…).
 * Callers may `await` it (safe) or fire-and-forget with `void`.
 */

import { getAdminClient } from '@/lib/analytics/server';
import { sendPushToUser } from '@/lib/push/server';
import type { NotificationType } from '@/lib/notifications/types';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** App-relative deep link (e.g. /ada/konneqts). */
  link?: string | null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    const admin = getAdminClient();

    // 1. Respect per-user preferences (defaults to all-on when no row).
    const { data: pref } = await admin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', input.userId)
      .maybeSingle();
    if (pref && pref[input.type] === false) return;

    // 2. Insert the in-app notification row.
    const { data: row, error } = await admin
      .from('notifications')
      .insert({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      })
      .select('id')
      .single();

    if (error) {
      // Expected pre-migration (notifications-setup.sql not run yet).
      console.warn(
        '[notifications] insert failed (non-fatal):',
        error.message,
      );
      return;
    }

    // 3. Device push — never awaited by callers that care about latency.
    void sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: input.link ?? '/notifications',
      tag: input.type,
      notificationId: row.id,
    });
  } catch (err) {
    console.warn(
      '[notifications] createNotification error (non-fatal):',
      err instanceof Error ? err.message : err,
    );
  }
}
