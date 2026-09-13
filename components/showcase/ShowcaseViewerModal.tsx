"use client";

import { useState } from "react";

import Modal from "@/components/ui/Modal";
import type { ShowcaseItem } from "@/lib/showcase";
import ShowcaseItemDetailModal from "./ShowcaseItemDetailModal";
import ShowcaseItemRow from "./ShowcaseItemRow";

/**
 * View-only showcase modal for VISITORS.
 *
 * Opened by the "Showcase · N items" trigger under the copy-link row on the
 * public card (ProfileCard). Unlike the owner's add/edit modal this one is
 * dismissable (backdrop click / Escape / X) — visitors expect to be able to
 * leave. Descriptions render in FULL here (owner rows clamp them), and
 * tapping a row opens the ENLARGED item detail (ShowcaseItemDetailModal)
 * stacked on top: image as the major portion, name / price / description
 * below in smaller fonts, close button at the top.
 *
 * While the detail modal is open, this list modal is made non-dismissable
 * (ui/Modal `dismissable={false}`) so Escape / backdrop clicks close ONLY
 * the detail modal — a light-stack, not a double-close.
 *
 * Mounted as a SIBLING of the flip-card inside ProfileCard (the
 * AppearanceModal pattern) — never inside the preserve-3d container, where
 * position:fixed would break (hence no createPortal needed).
 */
export default function ShowcaseViewerModal({
  open,
  onClose,
  items,
  ownerName,
}: {
  open: boolean;
  onClose: () => void;
  items: ShowcaseItem[];
  ownerName: string;
}) {
  // The enlarged per-item detail view; null = list view only.
  const [selected, setSelected] = useState<ShowcaseItem | null>(null);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        dismissable={!selected}
        maxWidthClass="max-w-lg"
        aria-label={`Showcase — ${ownerName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Showcase
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {items.length} {items.length === 1 ? "item" : "items"} by{" "}
              {ownerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close showcase"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              aria-label={`View ${item.name}`}
              className="block w-full cursor-pointer rounded-2xl text-left transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-(--main-orange) focus-visible:outline-none"
            >
              <ShowcaseItemRow item={item} showFullDescription />
            </button>
          ))}
        </div>
      </Modal>

      {/* Enlarged item detail — stacked above the list modal */}
      {selected && (
        <ShowcaseItemDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
