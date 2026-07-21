import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the waitlist page.
 * Shown instantly while the server page resolves.
 */
export default function Loading() {
  return <LoadingScreen label="Loading…" />;
}