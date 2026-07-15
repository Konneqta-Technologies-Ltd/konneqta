/**
 * Plan Badge — small tag showing "Freemium" or "Premium".
 *
 * Only visible to the profile owner. Positioned at top-right alongside the
 * Upgrade button (the UpgradeButton renders to its right).
 *
 * - Free  → "Freemium", amber background + border, rounded
 * - Pro   → "Premium",  green background + border, rounded
 */

export default function PlanBadge({
  isPro,
  show,
}: {
  isPro: boolean;
  show: boolean;
}) {
  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      <span
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
          isPro
            ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        }`}
      >
        {isPro ? "Premium" : "Freemium"}
      </span>
    </div>
  );
}