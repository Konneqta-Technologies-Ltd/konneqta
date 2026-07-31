"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ShareCount = {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  /** true while the initial fetch is in flight. */
  loading: boolean;
};

const DEFAULT: ShareCount = {
  used: 0,
  limit: 25,
  remaining: 25,
  unlimited: false,
  loading: true,
};

/**
 * Resolved state for Pro / unlimited users. The server already confirmed they
 * have unlimited shares, so we never need to fetch a count from the API — the
 * badge renders "∞" immediately on mount with zero roundtrip latency or
 * fragility.
 */
const PRO_UNLIMITED: ShareCount = {
  used: 0,
  limit: Infinity,
  remaining: Infinity,
  unlimited: true,
  loading: false,
};

type ShareCountContextValue = ShareCount & {
  /** Re-fetch the count from the server. Call after a successful share. */
  refresh: () => Promise<void>;
  /** Whether the owner has hit the 0/limit cap right now. */
  atLimit: boolean;
  /** True if the owner dismissed the limit modal this session. */
  limitDismissed: boolean;
  /** Called by the limit modal's close button. */
  dismissLimit: () => void;
  /**
   * Called by ShareMenu when a share is blocked (429) to force the limit
   * modal to reappear even if the owner previously dismissed it.
   */
  resetLimitDismissed: () => void;
};

const ShareCountContext = createContext<ShareCountContextValue | null>(null);

/**
 * ShareCountProvider — keeps the owner's monthly share usage in client state.
 *
 * Fetches `/api/share/count` on mount (owner-only; visitors render nothing
 * depending on this). After a share, callers invoke `refresh()` to pull the
 * freshly-decremented remaining count so the badge ticks down live without
 * any websockets.
 *
 * SOURCE OF TRUTH: The `isPro` prop is authoritative for the "unlimited"
 * display. When the server-rendered page already knows the owner is Pro, we
 * skip the API roundtrip entirely — this avoids a fragile second fetch that
 * can silently fail and show "25/25" for paying users. Free users still fetch
 * their live count as before.
 *
 * It also owns the "share limit reached" modal state (`limitDismissed`) so
 * that both the top-right badge cluster and the ShareMenu (which may live in
 * a different part of the tree but inside the same provider) can coordinate:
 * ShareMenu calls `resetLimitDismissed()` when a share is blocked by the
 * server, and the badge cluster renders the modal when `atLimit && !limitDismissed`.
 *
 * NOTE: This provider only controls the badge DISPLAY. The actual share
 * recording + limit enforcement happens server-side in POST /api/share and
 * is completely independent of this code.
 */
export function ShareCountProvider({
  children,
  isPro = false,
}: {
  children: ReactNode;
  isPro?: boolean;
}) {
  const [count, setCount] = useState<ShareCount>(isPro ? PRO_UNLIMITED : DEFAULT);
  const [limitDismissed, setLimitDismissed] = useState(false);

  const refresh = useCallback(async () => {
    // Pro users are unlimited — there's no count to refresh.
    if (isPro) return;
    try {
      const res = await fetch("/api/share/count", { cache: "no-store" });
      if (!res.ok) {
        console.error(
          "[ShareCountProvider] /api/share/count returned status",
          res.status
        );
        return;
      }
      const data = await res.json();
      setCount({ ...data, loading: false });
      // Auto-recover the dismissed flag when the count goes back above zero
      // (new month rolled over, plan upgraded, etc.) so the prompt can
      // reappear the next time they hit the cap.
      if (data.remaining > 0) setLimitDismissed(false);
    } catch (err) {
      // Non-fatal — badge stays at default. But now we log it so silent
      // failures (the root cause of the "25/25 for Pro users" bug) are
      // visible during debugging.
      console.error("[ShareCountProvider] fetch failed:", err);
      setCount((c) => ({ ...c, loading: false }));
    }
  }, [isPro]);

  // Initial load — fetch the count on mount. The setState happens after an
  // await (not synchronously), so this is a legitimate data-fetch effect.
  // Pro users skip the fetch entirely (the server already confirmed they're
  // unlimited).
  useEffect(() => {
    if (isPro) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/share/count", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          console.error(
            "[ShareCountProvider] /api/share/count returned status",
            res.status
          );
          setCount((c) => ({ ...c, loading: false }));
          return;
        }
        const data = await res.json();
        if (!active) return;
        setCount({ ...data, loading: false });
      } catch (err) {
        if (active) {
          console.error("[ShareCountProvider] fetch failed:", err);
          setCount((c) => ({ ...c, loading: false }));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isPro]);

  const atLimit =
    !count.loading && !count.unlimited && count.remaining <= 0;

  return (
    <ShareCountContext.Provider
      value={{
        ...count,
        refresh,
        atLimit,
        limitDismissed,
        dismissLimit: () => setLimitDismissed(true),
        resetLimitDismissed: () => setLimitDismissed(false),
      }}
    >
      {children}
    </ShareCountContext.Provider>
  );
}

/** Access the owner's share count + a refresh() method. */
export function useShareCount(): ShareCountContextValue {
  const ctx = useContext(ShareCountContext);
  if (!ctx) {
    // Safe fallback if rendered outside the provider (shouldn't happen, but
    // keeps the hook crash-proof in tests / edge cases).
    return {
      ...DEFAULT,
      refresh: async () => {},
      atLimit: false,
      limitDismissed: false,
      dismissLimit: () => {},
      resetLimitDismissed: () => {},
    };
  }
  return ctx;
}