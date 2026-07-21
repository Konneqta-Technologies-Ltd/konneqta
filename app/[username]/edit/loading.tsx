import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * Route loading UI for the Edit page.
 * Shown instantly while the edit page's Server Component + card data resolve.
 */
export default function Loading() {
  return <LoadingScreen label="Opening editor…" />;
}