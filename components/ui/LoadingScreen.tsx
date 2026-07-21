/**
 * LoadingScreen — branded, full-screen (or full-height) loading state.
 *
 * Shows the Konneqta "K" logo centered inside a spinning dual-ring spinner.
 * Designed to be used as the fallback in `loading.tsx` route files (shown
 * instantly while a Server Component + its data resolve) and also reused as
 * an overlay for client-side blocking actions.
 *
 * - Dark-mode aware: blends with `var(--background)` automatically.
 * - Accessible: role="status" + aria-live + sr-only label.
 * - Uses brand colors (orange #FF6B2C + purple #6A56A4) for the ring.
 *
 * Usage (route loading.tsx):
 *   import LoadingScreen from "@/components/ui/LoadingScreen";
 *   export default function Loading() { return <LoadingScreen />; }
 *
 * Usage (action overlay, full height of nearest relative parent):
 *   <LoadingScreen label="Sharing…" />
 */

type LoadingScreenProps = {
  /** Optional message shown under the spinner (sr-only by default). */
  label?: string;
  /**
   * Fill the viewport (min-h-screen) — default for route loaders.
   * Set false to only fill the nearest positioned/heighted parent.
   */
  fullScreen?: boolean;
};

export default function LoadingScreen({
  label = "Loading…",
  fullScreen = true,
}: LoadingScreenProps = {}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center bg-[var(--background)] ${
        fullScreen ? "min-h-screen" : "min-h-[60vh]"
      }`}
    >
      {/* ---- Logo + spinning ring ---- */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Outer ring (orange) */}
        <span
          className="absolute inset-0 animate-spin rounded-full border-4 border-transparent"
          style={{
            borderTopColor: "#FF6B2C",
            borderRightColor: "#FF6B2C",
          }}
        />
        {/* Inner ring (purple), counter-rotating for depth */}
        <span
          className="absolute inset-1.5 animate-spin rounded-full border-4 border-transparent"
          style={{
            animationDirection: "reverse",
            animationDuration: "1.4s",
            borderBottomColor: "#6A56A4",
            borderLeftColor: "#6A56A4",
          }}
        />
        {/* Center K logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/k-logo.png"
          alt=""
          aria-hidden="true"
          className="relative h-9 w-9 object-contain"
        />
      </div>

      {/* sr-only label for screen readers; tiny visible wordmark for polish */}
      <span className="sr-only">{label}</span>
      <span className="mt-3 text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500">
        Konneqta
      </span>
    </div>
  );
}