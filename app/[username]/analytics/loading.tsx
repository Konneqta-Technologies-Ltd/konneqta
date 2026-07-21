import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the Analytics dashboard.
 * Shown instantly while analytics queries resolve (heaviest server data load).
 */
export default function Loading() {
  return <LoadingScreen label="Loading analytics…" />;
}