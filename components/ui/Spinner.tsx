/**
 * Spinner — the single source of truth for loading indicators across the app.
 *
 * Replaces the ~6 copy-pasted inline SVG spinners scattered across components.
 * Uses `currentColor` so it inherits the parent's text color automatically,
 * including in dark mode.
 *
 * Usage:
 *   <Spinner size="sm" />   // h-4 w-4  — default, fits inside buttons
 *   <Spinner size="xs" />   // h-3 w-3  — inline next to small text
 *   <Spinner size="md" />   // h-5 w-5  — larger buttons / card actions
 *   <Spinner className="text-white" />  // override color via className
 */

type SpinnerSize = "xs" | "sm" | "md";

const SIZE_MAP: Record<SpinnerSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export default function Spinner({
  size = "sm",
  className = "",
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <svg
      className={`animate-spin ${SIZE_MAP[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}