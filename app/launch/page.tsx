import LaunchExperience from "@/components/LaunchExperience";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Konneqta",
  description: "Open your Konneqta card.",
  robots: { index: false, follow: false },
};

/**
 * PWA launcher (manifest start_url) — a STATIC, service-worker-PRECACACHED
 * page (see app/serwist/[path]/route.ts additionalPrecacheEntries) so it
 * opens instantly with ZERO network:
 *
 *   ONLINE  → immediately router.replace('/post-login'), which runs the
 *             existing server-side routing to the user's active card.
 *   OFFLINE → renders the owner's saved card right here (localStorage
 *             snapshot + on-device QR, see components/OfflineCard.tsx),
 *             skipping the network-dependent /post-login hop entirely.
 *
 * If navigator.onLine is wrong (says online but the connection is dead),
 * the /post-login navigation still fails → the SW's /offline fallback
 * renders the same card — graceful either way.
 */
export default function LaunchPage() {
  return <LaunchExperience />;
}
