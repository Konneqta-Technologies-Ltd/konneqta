"use client";

import { usePostHog } from "posthog-js/react";

/**
 * Reusable hook for capturing PostHog events from client components.
 *
 * Usage:
 *   const track = useTrack();
 *   track("profile_shared", { username: "john" });
 *
 * Safely no-ops if PostHog isn't loaded yet.
 */
export function useTrack() {
  const posthog = usePostHog();

  return (event: string, properties?: Record<string, unknown>) => {
    if (posthog) {
      posthog.capture(event, properties);
    }
  };
}