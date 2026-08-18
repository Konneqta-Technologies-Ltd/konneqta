import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the landing page (domain root "/").
 * Shown instantly while the root page's server components resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Loading…" />;
}