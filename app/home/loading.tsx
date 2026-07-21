import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the landing page.
 * Shown instantly while the home page's server components resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Loading…" />;
}