/**
 * Plan Badge — small tag showing "Freemium" or "Premium".
 *
 * Only visible to the profile owner. Rendered inline inside the top-right
 * cluster on the profile page, next to the ShareCounter and UpgradeButton.
 *
 * - Free  → "Freemium", amber background + border, rounded
 * - Pro   → "Premium",  green background + border, rounded
 *
 * NOTE: This is an INLINE element (no `fixed`). Positioning is handled by
 * the parent page which groups it with the ShareCounter + UpgradeButton.
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
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
        isPro
          ? "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      {isPro ? "Premium" : "Freemium"}
    </span>
  );
}