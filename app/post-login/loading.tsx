import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the post-login redirect.
 * Shown instantly while active-card resolution + redirect resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Signing you in…" />;
}