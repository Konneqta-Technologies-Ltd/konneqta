"use client";

import Image from "next/image";

import Modal from "@/components/ui/Modal";
import { showcaseInitial, type ShowcaseItem } from "@/lib/showcase";

/**
 * Enlarged, view-only detail view for ONE showcase item (visitor side).
 *
 * Opened by tapping a row in ShowcaseViewerModal. Layout per spec:
 *   - close (X) button at the top
 *   - the image takes the major portion (contained, never cropped — product
 *     shots must not lose their edges; square tile with a neutral backdrop)
 *   - name / price / description below in smaller fonts
 *
 * Mounted ONLY while open (parent conditional render) — no form state to
 * reset. Dismissable like the viewer modal (backdrop / Escape / X).
 */
export default function ShowcaseItemDetailModal({
  item,
  onClose,
}: {
  item: ShowcaseItem;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      maxWidthClass="max-w-md"
      aria-label={`${item.name} — showcase item`}
    >
      {/* Close button — top right, above everything */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close item"
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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

      {/* Image — the major portion of the modal (contained, not cropped) */}
      <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 448px) 88vw, 340px"
            className="object-contain"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-6xl font-bold text-(--main-orange)">
            {showcaseInitial(item.name)}
          </span>
        )}
      </div>

      {/* Name / price / description — below, smaller fonts */}
      <div className="mt-4">
        <h3 className="text-center text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {item.name}
        </h3>
        {item.price ? (
          <p className="mt-1 text-center text-sm font-semibold text-(--main-orange)">
            {item.price}
          </p>
        ) : null}
        {item.description ? (
          <p className="mx-auto mt-2 max-h-40 max-w-sm overflow-y-auto text-center text-xs leading-relaxed whitespace-pre-line text-zinc-500 dark:text-zinc-400">
            {item.description}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
