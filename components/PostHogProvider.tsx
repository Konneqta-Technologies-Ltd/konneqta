'use client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { useCookieConsent } from './CookieConsentBanner';

/**
 * PostHog React Provider — wraps the app to enable:
 *   - Automatic pageview tracking (route changes)
 *   - Session replay (opt-in via PostHog dashboard)
 *   - usePostHog() hook for custom event capture in any component
 *
 * Client-side only. Server-side capture is handled by lib/posthog.ts.
 */
export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const consent = useCookieConsent();

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
      // Capture page views automatically on route changes.
      capture_pageview: true,
      // Respect Do-Not-Track.
      opt_out_capturing_by_default: true,
      // Prevent capturing in tests / CI.
      loaded: (ph) => {
        if (process.env.NODE_ENV !== 'production') {
          ph.opt_out_capturing();
        }
      },
    });
  }, []);

  useEffect(() => {
    if (consent === 'accepted') {
      posthog.opt_in_capturing();
    } else if (consent === 'declined') {
      posthog.opt_out_capturing();
    }
  }, [consent]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
