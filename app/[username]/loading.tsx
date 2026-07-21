import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for a public profile (card view).
 * Shown instantly while entitlements/theme/profile data resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Loading card…" />;
}