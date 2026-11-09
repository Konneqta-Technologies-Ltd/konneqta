'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import { isTourExcludedRoute } from '@/lib/onboarding';

/**
 * Route-gated loader for the onboarding/product-tour widget.
 *
 * The widget (driver.js + framer-motion + its auth/profile lookups) used to
 * be mounted in the root layout on EVERY page — including the landing page
 * and auth pages where its own logic guarantees it can never display
 * anything. This gate is a tiny client island: on excluded routes it renders
 * NOTHING (no tour JS, no driver.js CSS, no auth calls); on card/app routes
 * it loads the real widget on demand.
 *
 * next/dynamic with ssr:false must live in a Client Component (Next.js
 * forbids it in Server Components) — hence this wrapper.
 */
const OnboardingWidget = dynamic(() => import('./OnboardingWidget'), {
  ssr: false,
});

export default function OnboardingGate() {
  const pathname = usePathname();
  if (isTourExcludedRoute(pathname)) return null;
  return <OnboardingWidget />;
}
