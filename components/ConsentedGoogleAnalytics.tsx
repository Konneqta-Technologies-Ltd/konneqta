'use client';

import Script from 'next/script';

import { useCookieConsent } from './CookieConsentBanner';

/**
 * The single, consent-gated Google Analytics loader.
 *
 * - Renders NOTHING until the visitor accepts cookies ("Accept all"), so
 *   "Necessary only" users are never tracked and gtag.js stays off the wire.
 * - Uses lazyOnload so the ~159 KiB gtag.js bundle only fetches after first
 *   paint + interactivity (off the critical path).
 * - IMPORTANT: this must remain the ONLY place gtag.js is injected app-wide.
 *   A second loader anywhere else double-counts every pageview.
 */
export default function ConsentedGoogleAnalytics() {
  const consent = useCookieConsent();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (consent !== 'accepted' || !gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
      />
      <Script id="ga-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
