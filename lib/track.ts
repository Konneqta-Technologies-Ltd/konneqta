type EventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Fire-and-forget analytics event → Google Analytics (gtag).
 *
 * Replaces the former PostHog client tracking (lib/use-track.ts). gtag.js is
 * only loaded after the visitor accepts cookies (ConsentedGoogleAnalytics,
 * lazyOnload), so without consent — or before it loads — this is a safe
 * no-op: events are dropped, never queued, mirroring the old consent-gated
 * PostHog behaviour.
 */
export function track(event: string, properties?: EventProperties): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
    .gtag;
  if (!gtag) return;
  gtag('event', event, properties ?? {});
}
