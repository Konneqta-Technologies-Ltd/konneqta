"use client";

import { useState, type ReactNode } from "react";
import Tooltip from "./Tooltip";

/**
 * ProGate — the visual gate for any Pro-only control.
 *
 * SECURITY NOTE
 * -------------
 * This component is UX only — it does NOT authorise anything. The real
 * gate is the DB trigger (supabase/entitlements-setup.sql) + RLS. This
 * component just decides whether to render a padlock overlay or the real
 * control. A determined user inspecting markup cannot escalate privileges
 * because the server/DB will reject the actual operation regardless.
 *
 * USAGE
 * -----
 * <ProGate allowed={canUploadLogo} label="Logo upload">
 *   <LogoUploader />
 * </ProGate>
 *
 * - When `allowed` is true → renders the children normally.
 * - When `allowed` is false → renders the children dimmed (pointer-events
 *   none) with a padlock badge. On hover/focus, shows a tooltip explaining
 *   the feature is Pro. Clicking navigates to the upgrade flow (Phase 5)
 *   or, for now, surfaces a toast.
 *
 * Why render the children at all (dimmed) instead of hiding them?
 * Showing the feature-but-locked drives upgrades better than hiding it.
 */
export default function ProGate({
  allowed,
  label,
  children,
  hideWhenLocked = false,
}: {
  /** True if the current user is entitled to use this feature. */
  allowed: boolean;
  /** Human-readable feature name, shown in the tooltip. */
  label: string;
  /** The real control to gate. */
  children: ReactNode;
  /**
   * If true, render nothing when locked (instead of a dimmed preview).
   * Use this when showing a ghost of the control would be confusing.
   */
  hideWhenLocked?: boolean;
}) {
  const [showUpgradeHint, setShowUpgradeHint] = useState(false);

  if (allowed) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  return (
    <Tooltip
      label={`${label} — Pro feature`}
      side="top"
    >
      <div className="relative">
        {/* Dimmed, non-interactive preview of the locked control */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none opacity-50 grayscale"
        >
          {children}
        </div>

        {/* Padlock badge, top-right of the locked control */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowUpgradeHint((v) => !v);
          }}
          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 text-white shadow-sm ring-1 ring-white/20 transition-transform hover:scale-110 dark:bg-zinc-100/90 dark:text-zinc-900"
          aria-label={`${label} is a Pro feature. Click to learn more.`}
        >
          {/* Padlock SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>

        {/* Inline upgrade hint (placeholder until Phase 5 billing exists) */}
        {showUpgradeHint && (
          <div className="absolute top-7 right-0 z-10 w-48 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
              {label} is a Pro feature
            </p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Upgrade to Pro to unlock this and more.
            </p>
            {/* TODO(Phase 5): wire to /upgrade or Flutterwave checkout */}
            <span className="mt-2 inline-block text-[11px] font-medium text-(--main-orange)">
              Coming soon
            </span>
          </div>
        )}
      </div>
    </Tooltip>
  );
}