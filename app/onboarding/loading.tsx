import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for onboarding.
 * Shown instantly while the auth check + redirect resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Getting things ready…" />;
}