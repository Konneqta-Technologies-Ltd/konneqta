'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  getKonneqtRequestInfo,
  type AppNotification,
  type KonneqtRequestStatus,
} from '@/lib/notifications/types';
import { respondToKonneqtRequest } from '@/lib/konneqts';

/**
 * Accept / Reject actions for konneqt_request notification rows.
 *
 * Rendered inside the /notifications page list (default size) and the
 * sidenav bell dropdown (compact icon-only buttons).
 *
 * - PENDING rows → Accept ✓ / Reject ✕ buttons. One request, one decision:
 *   the partial unique index on konneqt_requests blocks any repeat.
 * - Resolved rows → a static status chip (Accepted / Rejected). The server
 *   stamps data.requestStatus on the notification row, so other devices
 *   settle too; a local override covers this device optimistically.
 * - A 409 "already resolved" (answered on another device) settles the row
 *   instead of erroring.
 *
 * Clicks are stopped + default-prevented — the surrounding row is a <Link>
 * to the requester's profile and acting on the request must not navigate.
 */
export default function RequestActionButtons({
  notification,
  onResolved,
  compact = false,
}: {
  notification: AppNotification;
  /** Notify the parent so it can update its row copy / mark it read. */
  onResolved?: (
    notification: AppNotification,
    status: KonneqtRequestStatus,
  ) => void;
  /** Icon-only buttons for the narrow bell dropdown rows. */
  compact?: boolean;
}) {
  const info = getKonneqtRequestInfo(notification);
  // Local optimistic settle — takes precedence over the row's stored status.
  const [resolvedOverride, setResolvedOverride] =
    useState<KonneqtRequestStatus | null>(null);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  if (!info) return null;
  const status = resolvedOverride ?? info.requestStatus;
  if (status !== 'pending') {
    return (
      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          status === 'accepted'
            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
        }`}
      >
        {status === 'accepted' ? 'Accepted' : 'Rejected'}
      </span>
    );
  }

  const act = async (action: 'accept' | 'reject') => {
    if (busy) return;
    setBusy(action);
    try {
      // Already-answered-elsewhere (409) comes back as the settled status.
      const resolved = await respondToKonneqtRequest(info.requestId, action);
      setResolvedOverride(resolved);
      onResolved?.(notification, resolved);
      if (resolved === 'accepted') {
        toast.success("You're now Konneqted — find them in your Konneqts.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  /** Kill both the <Link> navigation and React's synthetic bubbling. */
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };


  return (
    <span onClick={stop} onPointerDown={stop} className="mt-2 flex w-fit gap-2">
      <button
        type="button"
        onClick={() => void act('accept')}
        disabled={busy !== null}
        aria-label="Accept Konneqt request"
        className={
          compact
            ? 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-green-600 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
            : 'inline-flex cursor-pointer items-center rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {busy === 'accept' ? (
          <svg
            className="h-3 w-3 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : compact ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          'Accept'
        )}
      </button>
      <button
        type="button"
        onClick={() => void act('reject')}
        disabled={busy !== null}
        aria-label="Reject Konneqt request"
        className={
          compact
            ? 'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
            : 'inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
        }
      >
        {compact ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : busy === 'reject' ? (
          'Declining…'
        ) : (
          'Reject'
        )}
      </button>
    </span>
  );
}
