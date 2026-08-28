'use client';

import { Analytics } from '@vercel/analytics/next';
import { useCookieConsent } from './CookieConsentBanner';

/**
 * Consent-gated Vercel Analytics.
 *
 * Vercel's insight script is a third-party tracker under the ePrivacy/GDPR
 * rules the rest of the app follows (Google Analytics + PostHog are already
 * consent-gated), so it only mounts after the visitor picks "Accept all".
 *
 * Do NOT add a bare <Analytics /> elsewhere — it would track users who chose
 * "Necessary only".
 */
export default function ConsentedVercelAnalytics() {
  const consent = useCookieConsent();

  if (consent !== 'accepted') return null;
  return <Analytics />;
}
