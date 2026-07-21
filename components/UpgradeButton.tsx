"use client";

import PaymentOptionsModal from "./PaymentOptionsModal";
import { useState } from "react";

/**
 * Upgrade Button — inline "Upgrade" pill.
 *
 * Only rendered when:
 *   - `show` is true (the visitor IS the profile owner AND owner is NOT Pro)
 *
 * Clicking it opens `PaymentOptionsModal` where the user chooses between
 * auto-renew (card) and one-time (card/transfer/USSD).
 *
 * NOTE: This is an INLINE element (no `fixed`). It is placed inside the
 * top-right cluster by the parent page so it sits beside the plan badge
 * and share counter.
 */
export default function UpgradeButton({ show }: { show: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!show) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, #FF6B2C, #8B5CF6)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l2.4 7.4H22l-6.2 4.6 2.4 7.4-6.2-4.6-6.2 4.6 2.4-7.4L2 9.4h7.6z" />
        </svg>
        Upgrade
      </button>

      <PaymentOptionsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}