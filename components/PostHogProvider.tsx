'use client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import posthog from 'posthog-js';
import { useCookieConsent } from './CookieConsentBanner';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

/** Tracks the distinct id we last identified as (avoids duplicate $identify events). */
let identifiedUserId: string | null = null;

/**
 * PostHog React Provider — wraps the app to enable:
 *   - Automatic pageview tracking (route changes)
 *   - Session replay (opt-in via PostHog dashboard)
 *   - usePostHog() hook for custom event capture in any component
 *   - identify(): links anonymous client activity to the signed-in user
 *
 * Client-side only. Server-side capture is handled by lib/posthog.ts.
 *
 * IDENTITY
 * --------
 * Server-side events (account_deleted, konneqt_created, card_shared, …)
 * already use the Supabase user id as the PostHog distinct id. Identifying
 * the browser client with the SAME id merges the two into one person, which
 * unlocks real funnels (signup → share → konneqt → upgrade) and retention.
 * Without this, every device is a separate anonymous person in PostHog.
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
      // Disable the surveys extension bundle (~26 KiB). We don't use PostHog
      // surveys — this stops surveys.js + its preact dep from loading.
      disable_surveys: true,
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

  // ── Identity: merge client + server activity into one PostHog person ──────
  useEffect(() => {
    // Only identify once analytics consent is given.
    if (consent !== 'accepted') return;

    const supabase = createClient();
    let disposed = false;

    const identify = (userId: string, email?: string | null) => {
      if (disposed || identifiedUserId === userId) return;
      identifiedUserId = userId;
      posthog.identify(userId, email ? { email } : undefined);
    };

    // Identify immediately if a session already exists…
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) identify(session.user.id, session.user.email);
      })
      .catch(() => {});

    // …and follow every subsequent sign-in / sign-out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        identifiedUserId = null;
        posthog.reset();
      } else {
        identify(session.user.id, session.user.email);
      }
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [consent]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
