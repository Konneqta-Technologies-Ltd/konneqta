'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

const CONSENT_KEY = 'konneqta_cookie_consent';
const CONSENT_EVENT = 'konneqta-consent-changed';

export type ConsentValue = 'accepted' | 'declined';

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): ConsentValue | null {
  return localStorage.getItem(CONSENT_KEY) as ConsentValue | null;
}

// During SSR there's no localStorage — treat as "no decision yet" so the
// server-rendered markup and the first client render agree.
function getServerSnapshot(): ConsentValue | null {
  return null;
}

export function useCookieConsent() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setCookieConsent(value: ConsentValue) {
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function clearCookieConsent() {
  localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export default function CookieConsentBanner() {
  const consent = useCookieConsent();
  const visible = consent === null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 px-6 py-5 backdrop-blur sm:px-10"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-zinc-400">
              We use cookies to run Konneqta and understand how it&apos;s used,
              including via Google Analytics. Read our{' '}
              <Link
                href="/privacy"
                className="text-(--main-orange) hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              to learn more.
            </p>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => setCookieConsent('declined')}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={() => setCookieConsent('accepted')}
                className="rounded-lg bg-(--main-orange) px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
