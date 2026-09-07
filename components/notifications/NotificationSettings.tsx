'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTrack } from '@/lib/use-track';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
} from '@/lib/notifications/types';

type PushSupport =
  | 'checking'
  | 'unsupported'
  | 'denied'
  | 'off'
  | 'enabled'
  | 'working';

/** VAPID public key (base64url) → Uint8Array for pushManager.subscribe().
 *  Built on an explicit ArrayBuffer so the result satisfies BufferSource
 *  under TS 5.7+'s typed-array generics. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** iOS Safari only allows Web Push inside an INSTALLED PWA (16.4+). */
function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

/**
 * Settings → Notifications section.
 *
 * Row 1: device push (permission-aware enable/disable button + honest
 *        status, incl. the iOS "install the app first" case).
 * Row 2+: per-type toggles persisted to notification_preferences.
 */
export default function NotificationSettings() {
  const track = useTrack();
  const [pushState, setPushState] = useState<PushSupport>('checking');
  const [iosHint, setIosHint] = useState(false);
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>({
    konneqt: true,
    guest_konneqt: true,
    referral: true,
    pro_expiry: true,
    weekly_digest: true,
    share_limit: true,
  });

  // Probe what this browser/device can do + whether we already have a sub.
  // All setState happens inside async callbacks (never synchronously in the
  // effect body) per react-hooks/set-state-in-effect.
  useEffect(() => {
    const swSupported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    let cancelled = false;
    void (async () => {
      const ios = isIosBrowser();
      let state: PushSupport = 'off';
      if (!swSupported) {
        state = 'unsupported';
      } else if (Notification.permission === 'denied') {
        state = 'denied';
      } else {
        state = await navigator.serviceWorker
          .ready
          .then((reg) => reg.pushManager.getSubscription())
          .then((sub) => (sub ? ('enabled' as const) : ('off' as const)))
          .catch(() => 'off' as const);
      }
      if (cancelled) return;
      setIosHint(ios);
      setPushState(state);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load per-type preferences (missing row = defaults all-on).
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPrefs({
              konneqt: data.konneqt,
              guest_konneqt: data.guest_konneqt,
              referral: data.referral,
              pro_expiry: data.pro_expiry,
              weekly_digest: data.weekly_digest,
              share_limit: data.share_limit,
            });
          }
        });
    });
  }, []);

  const enablePush = useCallback(async () => {
    setPushState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('VAPID key missing');

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('subscribe save failed');

      setPushState('enabled');
      track('push_enabled');
    } catch {
      setPushState('off');
    }
  }, [track]);

  const disablePush = useCallback(async () => {
    setPushState('working');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setPushState('off');
      track('push_disabled');
    } catch {
      setPushState('off');
    }
  }, [track]);

  const toggleType = useCallback(
    (type: NotificationType) => {
      const next = !prefs[type];
      setPrefs((p) => ({ ...p, [type]: next }));
      const supabase = createClient();
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        void supabase.from('notification_preferences').upsert({
          user_id: user.id,
          [type]: next,
          updated_at: new Date().toISOString(),
        });
      });
    },
    [prefs],
  );
// __RENDER__
  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Notifications
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Get notified on your device when people Konneqt with you.
      </p>

      {/* Device push */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Device notifications
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {pushState === 'checking' && 'Checking this device…'}
            {pushState === 'working' && 'Just a moment…'}
            {pushState === 'enabled' && 'On — this device receives pushes.'}
            {pushState === 'off' && 'Off for this device.'}
            {pushState === 'unsupported' &&
              'Not supported by this browser or site mode.'}
            {pushState === 'denied' &&
              'Blocked in your browser settings — allow Konneqta and retry.'}
          </p>
        </div>
        {(pushState === 'off' || pushState === 'denied') && (
          <button
            type="button"
            onClick={enablePush}
            className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--main-orange)' }}
          >
            Turn on
          </button>
        )}
        {pushState === 'enabled' && (
          <button
            type="button"
            onClick={disablePush}
            className="shrink-0 cursor-pointer rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Turn off
          </button>
        )}
      </div>

      {iosHint && pushState !== 'enabled' && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          On iPhone/iPad, notifications only work inside the installed app —
          use &ldquo;Install App&rdquo; in the menu first, then return here to
          turn them on.
        </p>
      )}

      {/* Per-type preferences */}
      <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          What to notify me about
        </p>
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {NOTIFICATION_TYPES.map((type) => (
            <li
              key={type}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {NOTIFICATION_TYPE_LABELS[type]}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[type]}
                aria-label={NOTIFICATION_TYPE_LABELS[type]}
                onClick={() => toggleType(type)}
                className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  prefs[type]
                    ? 'bg-(--main-orange)'
                    : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    prefs[type] ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
