/**
 * LoadingButton — drop-in <button> replacement with built-in loading UX.
 *
 * Solves the three things every async button needs:
 *  1. Shows a Spinner when `loading` is true
 *  2. Swaps the label to `loadingText`
 *  3. Disables itself (prevents double-submits)
 *
 * Variants match the app's existing button styles so swapping a plain
 * <button> for <LoadingButton> doesn't change the look.
 *
 * Usage:
 *   <LoadingButton loading={loading} loadingText="Saving…" variant="primary">
 *     Save
 *   </LoadingButton>
 *
 * Pass-through props (onClick, type, className, etc.) work exactly like <button>.
 */

import { type ButtonHTMLAttributes } from "react";
import Spinner from "./Spinner";

type Variant = "primary" | "danger" | "secondary" | "outline" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-(--main-orange) text-white hover:opacity-90",
  danger:
    "bg-red-500 text-white hover:bg-red-600",
  secondary:
    "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600",
  outline:
    "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

const BASE_CLASSES =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** When true, shows a spinner + `loadingText` and disables the button. */
  loading?: boolean;
  /** Text shown while loading. Falls back to the children if omitted. */
  loadingText?: string;
  /** Visual style. Defaults to "primary". */
  variant?: Variant;
  /** Render as full-width (w-full). */
  fullWidth?: boolean;
};

export default function LoadingButton({
  loading = false,
  loadingText,
  variant = "primary",
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && <Spinner size="sm" className="shrink-0" />}
      {loading ? loadingText ?? children : children}
    </button>
  );
}