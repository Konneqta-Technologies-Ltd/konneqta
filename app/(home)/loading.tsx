import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the landing page (route group `(home)` -> "/").
 *
 * Scoped to this group DELIBERATELY. A root-level app/loading.tsx wraps
 * every route in the app in a <Suspense> boundary — including public
 * profiles — which starts the response streaming before app/[username]'s
 * notFound() can run. Once the shell is flushed the status code is locked
 * to 200, so missing profiles became "soft 404s" (200 + noindex) instead
 * of real 404s. Profile pages intentionally render without a skeleton so
 * bogus slugs return a true HTTP 404.
 */
export default function Loading() {
  return <LoadingScreen label="Loading…" />;
}
