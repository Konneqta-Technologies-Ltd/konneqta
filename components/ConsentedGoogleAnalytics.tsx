'use client';

import { GoogleAnalytics } from '@next/third-parties/google';

import { useCookieConsent } from './CookieConsentBanner';

export default function ConsentedGoogleAnalytics() {
  const consent = useCookieConsent();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (consent !== 'accepted' || !gaId) return null;

  return <GoogleAnalytics gaId={gaId} />;
}
