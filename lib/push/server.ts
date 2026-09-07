/**
 * Web Push sender (server-only).
 *
 * Sends VAPID-signed Web Push messages to every stored subscription of a
 * user. Designed to be fire-and-forget: never throws to the caller, and
 * self-cleans subscriptions the push service reports as gone (404/410) —
 * e.g. after the user uninstalled the PWA or the browser rotated keys.
 *
 * Env vars (see supabase/notifications-setup.sql + .env.local):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — shared with the browser for subscribe()
 *   VAPID_PRIVATE_KEY            — server-only signing key
 *   VAPID_SUBJECT                — contact URI (mailto:) for the push service
 */

import webpush from 'web-push';
import { getAdminClient } from '@/lib/analytics/server';

export interface PushPayload {
  title: string;
  body: string;
  /** App-relative deep link opened when the notification is tapped. */
  url?: string | null;
  /** Collapse key — stacks replaces within the same type. */
  tag?: string;
  /** In-app notification row id (lets the app mark it read on open). */
  notificationId?: string;
}

let configured = false;

function ensureConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:info@konneqta.com',
      pub,
      priv,
    );
    configured = true;
  }
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) {
    // Keys not configured (e.g. preview env) — in-app notifications only.
    return { sent: 0, removed: 0 };
  }

  try {
    const admin = getAdminClient();
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!subs?.length) return { sent: 0, removed: 0 };

    const json = JSON.stringify(payload);
    let sent = 0;
    let removed = 0;

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            json,
          );
          sent++;
        } catch (err) {
          const statusCode =
            (err as { statusCode?: number })?.statusCode ?? undefined;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription no longer exists at the push service — remove it
            // so it doesn't poison every future send.
            await admin
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
            removed++;
          }
          // 429 (rate limited) and transient network errors: skip silently —
          // the in-app notification row is the source of truth.
        }
      }),
    );

    return { sent, removed };
  } catch (err) {
    console.warn(
      '[push] sendPushToUser failed (non-fatal):',
      err instanceof Error ? err.message : err,
    );
    return { sent: 0, removed: 0 };
  }
}
