"use client";

import { useEffect } from "react";

/**
 * Reusable modal/dialog overlay.
 *
 * Renders a fixed full-screen backdrop + a centered card. Closes on:
 *  - backdrop click (unless `dismissable` is false)
 *  - Escape key (unless `dismissable` is false)
 *
 * Uses a portal-free approach (fixed positioning at z-[60], above the
 * sidenav drawer at z-50) consistent with the existing PaymentOptionsModal
 * and AppearanceModal patterns in this project.
 *
 * Accessibility: the panel is labelled via `aria-label` (or `aria-labelledby`
 * when a title id is supplied). Body scroll is locked while open.
 */
export type ModalProps = {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user requests close (backdrop click / Escape). */
  onClose: () => void;
  /** Modal content. */
  children: React.ReactNode;
  /** Max width utility class for the panel. Default "max-w-sm". */
  maxWidthClass?: string;
  /** If false, disables backdrop-click + Escape closing (e.g. during async work). Default true. */
  dismissable?: boolean;
  /** Accessible label for the dialog panel. */
  "aria-label"?: string;
};

export default function Modal({
  open,
  onClose,
  children,
  maxWidthClass = "max-w-sm",
  dismissable = true,
  "aria-label": ariaLabel,
}: ModalProps) {
  // Lock body scroll while open + wire up Escape-to-close.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (dismissable && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (dismissable) onClose();
      }}
      role="presentation"
    >
      <div
        className={`w-full ${maxWidthClass} rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}