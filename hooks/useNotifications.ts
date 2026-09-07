'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AppNotification } from '@/lib/notifications/types';

/** Items shown in the sidenav dropdown (full list lives on /notifications). */
export const DROPDOWN_ITEM_COUNT = 10;

/**
 * Notification feed state for the signed-in user: unread count (red dot) +
 * the latest items (dropdown). Used once, by AppNavbar, which passes the
 * data down to the hamburger badge and the sidenav bell.
 *
 * Updates come from (whichever fires first):
 *   1. Supabase Realtime INSERTs on `notifications` (requires the realtime
 *      publication — see supabase/notifications-setup.sql; silently
 *      no-ops when unavailable)
 *   2. A 60s poll + refresh on tab focus — the reliable fallback
 */
export function useNotifications(userId: string | null | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setItems([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [countRes, listRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null),
      supabase
        .from('notifications')
        .select(
          'id, type, title, body, link, read_at, created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(DROPDOWN_ITEM_COUNT),
    ]);
    setUnreadCount(countRes.count ?? 0);
    setItems((listRes.data as AppNotification[]) ?? []);
    setLoading(false);
  }, [userId]);

  // Initial load + user changes. Runs on a 0ms timeout so every setState
  // happens inside a callback (refresh has a synchronous no-user path —
  // calling it directly in the effect body trips set-state-in-effect).
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  // Realtime INSERTs (best-effort) + polling/focus fallback (always on).
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    const poll = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);

  /** Push-tap deep links carry ?n={id} — mark just that one read + strip. */
  useEffect(() => {
    if (!userId) return;
    const params = new URLSearchParams(window.location.search);
    const nId = params.get('n');
    if (!nId) return;

    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nId }),
    })
      .then(() => refresh())
      .catch(() => {});

    params.delete('n');
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
    );
  }, [userId, refresh]);

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    },
    [],
  );

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    setUnreadCount(0);
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }, []);

  return { unreadCount, items, loading, refresh, markRead, markAllRead };
}

/** "just now" / "5m ago" / "2h ago" / "3d ago" — dropdown + page rows. */
export function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
