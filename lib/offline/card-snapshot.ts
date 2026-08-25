/**
 * Offline card snapshot — the owner's card data persisted to localStorage so
 * the installed PWA can render their card (and a freshly generated, scannable
 * QR) with ZERO network.
 *
 * Why localStorage and not Cache Storage / IndexedDB?
 *   - Tiny (~2–4 KB JSON) and synchronous to read, so the offline page can
 *     render the card on its first client pass with no async juggling.
 *   - The service worker also caches the card PAGE (konneqta-pages, see
 *     app/sw.ts), but that cache is best-effort — this snapshot is the
 *     guarantee for the PWA's "open to my card offline" experience.
 *
 * Privacy: this lives ONLY on the owner's own device, contains the same
 * fields their public profile page renders (already entitlement- and
 * privacy-gated by the server before saving), and is cleared on logout /
 * account deletion / deactivation (see the callers).
 */

import type { ThemeCustomization } from "@/lib/themes";

const SNAPSHOT_KEY = "kq_offline_card_v1";

export type OfflineCardProfile = {
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  /** Already privacy-gated by the server before the snapshot was saved. */
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  qr_code_url: string | null;
  theme: string | null;
  banner_url: string | null;
  theme_custom: ThemeCustomization | null;
};

export type OfflineSocialLink = {
  platform: string;
  url: string;
  label?: string | null;
};

export type OfflineCardSnapshot = {
  version: 1;
  savedAt: string;
  profile: OfflineCardProfile;
  socialLinks: OfflineSocialLink[];
};

export function saveOfflineCardSnapshot(input: {
  profile: OfflineCardProfile;
  socialLinks: OfflineSocialLink[];
}): void {
  try {
    const snapshot: OfflineCardSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      profile: input.profile,
      socialLinks: input.socialLinks,
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage can throw (quota, private mode, disabled) — never break
    // the page render over an optional offline cache.
  }
}

export function readOfflineCardSnapshot(): OfflineCardSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineCardSnapshot;
    // Basic shape guard — discard anything malformed.
    if (parsed?.version !== 1 || !parsed.profile?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineCardSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Non-fatal.
  }
}