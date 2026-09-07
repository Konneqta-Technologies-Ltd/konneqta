'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { AppNotification } from '@/lib/notifications/types';
import { formatRelativeTime } from '@/hooks/useNotifications';
import NotificationIcon, { BellIcon } from './NotificationIcon';

const PAGE_SIZE = 30;

/**
 * Client list for /notifications — rows mark-read on tap, "Mark all read",
 * and "Load more" pagination. Initial data comes from the server component
 * (which remounts this list via `key` when its data changes); further pages
 * are fetched with the browser client (RLS-scoped).
 */
export default function NotificationList({
  initialItems,
  initialHasMore,
}: {
  initialItems: AppNotification[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasUnread = items.some((n) => !n.read_at);

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(items.length, items.length + PAGE_SIZE);
      const rows = (data ?? []) as AppNotification[];
      setHasMore(rows.length > PAGE_SIZE);
      setItems((prev) => [...prev, ...rows.slice(0, PAGE_SIZE)]);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length]);
// __RENDER__
  return (
    <div>
      {hasUnread && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-(--main-orange) dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Mark all read
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <BellIcon className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              You&rsquo;re all caught up
            </p>
            <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
              New Konneqts, referral rewards and more will show up here.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const unread = !n.read_at;
            return (
              <Link
                key={n.id}
                href={n.link ?? '/notifications'}
                onClick={() => unread && markRead(n.id)}
                className="flex gap-3 border-b border-zinc-100 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/60"
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    unread
                      ? 'bg-(--main-orange)/10 text-(--main-orange)'
                      : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                  }`}
                >
                  <NotificationIcon type={n.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={`text-sm ${
                        unread
                          ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                          : 'font-medium text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {n.body}
                  </span>
                </span>
                {unread && (
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-(--main-orange)"
                  />
                )}
              </Link>
            );
          })
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
