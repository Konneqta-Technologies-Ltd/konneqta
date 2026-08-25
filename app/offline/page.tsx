import OfflineExperience from "@/components/OfflineExperience";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline · Konneqta",
  description: "You are offline.",
  robots: { index: false, follow: false },
};

/**
 * Offline fallback page (static route: /offline).
 *
 * Precached by the Serwist service worker and shown when a navigation request
 * fails AND there is no cached version available (e.g. a cold PWA launch with
 * no network, or a profile URL never visited before).
 *
 * For the INSTALLED PWA, OfflineExperience renders the owner's saved card
 * (see lib/offline/card-snapshot.ts) so launching the app with zero network
 * still opens their card — with a freshly generated, scannable QR. Everyone
 * else gets the generic "You're offline" screen below.
 *
 * Pages the user has visited before are served instantly from the
 * "konneqta-pages" cache (NetworkFirst strategy). This page is the
 * last-resort fallback.
 */
export default function OfflinePage() {
  return <OfflineExperience />;
}