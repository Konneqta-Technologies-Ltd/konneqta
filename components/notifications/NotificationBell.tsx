'use client';

import NotificationIcon, { BellIcon } from './NotificationIcon';
import { useEffect, useRef, useState } from 'react';

import type { AppNotification } from '@/lib/notifications/types';
import Link from 'next/link';
import { formatRelativeTime } from '@/hooks/useNotifications';

/** Data contract between AppNavbar (hook owner) → SideNav → this bell. */
export interface NotificationBellProps {
  unreadCount: number;
  items: AppNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  /** Called when a row/footer link navigates — lets the drawer close itself. */
  onNavigate?: () => void;
}

/**
 * Sidenav notification bell (sits beside the dark-mode toggle).
 *
 * - Red dot while there are unread notifications.
 * - Click → dropdown with the 10 latest items (fixed height, internally
 *   scrollable), "Mark all read", and a "See more" link to /notifications.
 * - Tapping an item marks it read and deep-links to its target.
 */
export default function NotificationBell({
  unreadCount,
  items,
  loading,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click (the drawer's Escape handler closes the drawer).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-950"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute top-full -left-30 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="cursor-pointer text-[11px] font-medium text-zinc-500 transition-colors hover:text-(--main-orange) dark:text-zinc-400"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List — fixed height, internally scrollable */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
                <BellIcon className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  You&rsquo;re all caught up
                </p>
              </div>
            ) : (
              items.map((n) => {
                const unread = !n.read_at;
                return (
                  <Link
                    key={n.id}
                    href={n.link ?? '/notifications'}
                    onClick={() => {
                      if (unread) onMarkRead(n.id);
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex gap-2.5 border-b border-zinc-100 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/60"
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        unread
                          ? 'bg-(--main-orange)/10 text-(--main-orange)'
                          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                      }`}
                    >
                      <NotificationIcon type={n.type} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-xs ${
                            unread
                              ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                              : 'font-medium text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {n.body}
                      </span>
                    </span>
                    {unread && (
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--main-orange)"
                      />
                    )}
                  </Link>
                );
              })
            )}
          </div>
          {/* Footer — See more */}
          <Link
            href="/notifications"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex items-center justify-center gap-1 border-t border-zinc-200 px-3 py-2.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-(--main-orange) dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            See more
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
