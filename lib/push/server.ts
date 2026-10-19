/**
 * Device push senders (server-only).
 *
 * sendPushToUser() fans a notification out to EVERY device surface a user
 * has registered:
 *   1. Web Push (VAPID)  → browser/PWA subscriptions (push_subscriptions)
 *   2. Expo Push          → the native app's devices (mobile_push_tokens)
 *
 * Both legs are fire-and-forget by contract: never throw to the caller, and
 * self-clean registrations the push service reports as gone so they don't
 * poison future sends. The in-app notification row (notifications table)
 * remains the source of truth.
 *
 * Env vars (Web Push leg — see supabase/notifications-setup.sql + .env.local):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — shared with the browser for subscribe()
 *   VAPID_PRIVATE_KEY            — server-only signing key
 *   VAPID_SUBJECT                — contact URI (mailto:) for the push service
 *
 * The Expo leg needs NO server keys — the push token itself encodes the
 * destination project.
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

/** Leg 1 — VAPID Web Push to browser/PWA subscriptions. */
async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) {
    // Keys not configured (e.g. preview env) — browser push silently off.
    return { sent: 0, removed: 0 };
  }

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
}

// Expo Push API: hard limit of 100 messages per request.
const EXPO_PUSH_CHUNK = 100;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Leg 2 — Expo Push to the MOBILE app's registered devices
 * (mobile_push_tokens, registered via POST /api/push/register). The web
 * `url` (e.g. "/ada" or "/ada/konneqts") travels in `data`; the app
 * deep-links on tap via its konneqta:// scheme.
 */
async function sendExpoPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const admin = getAdminClient();
  const { data: tokens } = await admin
    .from('mobile_push_tokens')
    .select('id, token')
    .eq('user_id', userId);

  if (!tokens?.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;

  for (let i = 0; i < tokens.length; i += EXPO_PUSH_CHUNK) {
    const chunk = tokens.slice(i, i + EXPO_PUSH_CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((t) => ({
            to: t.token,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            data: {
              url: payload.url ?? null,
              notificationId: payload.notificationId ?? null,
              tag: payload.tag ?? null,
            },
          })),
        ),
      });

      const result = (await res.json().catch(() => ({}))) as {
        data?: {
          status: 'ok' | 'error';
          message?: string;
          details?: { error?: string };
        }[];
      };

      (result.data ?? []).forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          sent++;
          return;
        }
        // DeviceNotRegistered = app uninstalled / token rotated — remove the
        // row so it doesn't poison every future send (web-push parity).
        if (ticket.details?.error === 'DeviceNotRegistered' && chunk[index]) {
          void admin
            .from('mobile_push_tokens')
            .delete()
            .eq('id', chunk[index].id)
            .then(
              () => {},
              () => {},
            );
          removed++;
        }
        // Everything else (rate limits, transient errors): skip silently.
      });
    } catch {
      // Network-level failure — skip silently; the in-app row is the truth.
    }
  }

  return { sent, removed };
}

/**
 * Fan a notification out to every device surface. Both legs run in
 * parallel; each swallows its own errors (non-fatal by contract).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const [web, expo] = await Promise.allSettled([
    sendWebPushToUser(userId, payload),
    sendExpoPushToUser(userId, payload),
  ]);

  const sent =
    (web.status === 'fulfilled' ? web.value.sent : 0) +
    (expo.status === 'fulfilled' ? expo.value.sent : 0);
  const removed =
    (web.status === 'fulfilled' ? web.value.removed : 0) +
    (expo.status === 'fulfilled' ? expo.value.removed : 0);

  return { sent, removed };
}
