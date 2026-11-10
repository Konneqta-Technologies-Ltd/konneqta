"use client";

import { saveOfflineCardSnapshot } from "@/lib/offline/card-snapshot";
import type {
  OfflineCardProfile,
  OfflineSocialLink,
} from "@/lib/offline/card-snapshot";
import { useEffect } from "react";

/**
 * Invisible owner-only component. Mounted on the card page (app/[username])
 * when the viewer is the card's owner — refreshes the offline snapshot on
 * every online view so the installed PWA can render the card (with a fresh,
 * scannable QR) even with zero network.
 *
 * Renders nothing; must never affect layout.
 */
export default function OfflineCardSaver({
  profile,
  socialLinks,
  linkLimit,
}: {
  profile: OfflineCardProfile;
  socialLinks: OfflineSocialLink[];
  /** Active-link cap at save time (null = all active). */
  linkLimit?: number | null;
}) {
  useEffect(() => {
    saveOfflineCardSnapshot({ profile, socialLinks, linkLimit });
  }, [profile, socialLinks, linkLimit]);

  return null;
}