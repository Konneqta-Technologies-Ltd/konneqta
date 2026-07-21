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
 * It also owns the "share limit reached" modal state (`limitDismissed`) so
 * that both the top-right badge cluster and the ShareMenu (which may live in
 * a different part of the tree but inside the same provider) can coordinate:
 * ShareMenu calls `resetLimitDismissed()` when a share is blocked by the
 * server, and the badge cluster renders the modal when `atLimit && !limitDismissed`.
 */
export function ShareCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<ShareCount>(DEFAULT);
  const [limitDismissed, setLimitDismissed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/share/count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCount({ ...data, loading: false });
      // Auto-recover the dismissed flag when the count goes back above zero
      // (new month rolled over, plan upgraded, etc.) so the prompt can
      // reappear the next time they hit the cap.
      if (data.remaining > 0) setLimitDismissed(false);
    } catch {
      // Non-fatal — badge stays at default.
      setCount((c) => ({ ...c, loading: false }));
    }
  }, []);

  // Initial load — fetch the count on mount. The setState happens after an
  // await (not synchronously), so this is a legitimate data-fetch effect.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/share/count", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setCount((c) => ({ ...c, loading: false }));
          return;
        }
        const data = await res.json();
        if (!active) return;
        setCount({ ...data, loading: false });
      } catch {
        if (active) setCount((c) => ({ ...c, loading: false }));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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