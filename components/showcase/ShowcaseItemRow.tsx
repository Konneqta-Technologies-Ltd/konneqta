"use client";

import { showcaseInitial, type ShowcaseItem } from "@/lib/showcase";
import Image from "next/image";

/**
 * One showcase item rendered as a row: image tile on the left, name / short
 * description / price stacked top-to-bottom on the right. Shared by the
 * owner's management grid and the visitor's view-only modal so both surfaces
 * look identical.
 *
 * - `actions` renders the owner's edit/delete menu to the right (visitors
 *   get none).
 * - Owner rows clamp the description to 2 lines; the visitor modal passes
 *   `showFullDescription` — it IS the detail view (no per-item expand step).
 * - No image → tinted tile with the item's initial (image is optional).
 */
export default function ShowcaseItemRow({
  item,
  actions,
  showFullDescription = false,
}: {
  item: ShowcaseItem;
  /** Owner-only controls (the edit/delete chevron menu), rendered right. */
  actions?: React.ReactNode;
  /** Visitor modal shows the full description; owner rows clamp to 2 lines. */
  showFullDescription?: boolean;
}) {
  return (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Image tile (or initial-letter placeholder when there's no image) */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-(--main-orange)/10 sm:h-24 sm:w-24">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-(--main-orange)">
            {showcaseInitial(item.name)}
          </span>
        )}
      </div>

      {/* Name → description → price, top to bottom */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          title={item.name}
        >
          {item.name}
        </p>
        {item.description ? (
          <p
            className={`mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 ${
              showFullDescription ? "whitespace-pre-line" : "line-clamp-2"
            }`}
          >
            {item.description}
          </p>
        ) : null}
        {item.price ? (
          <p className="mt-1 text-sm font-semibold text-(--main-orange)">
            {item.price}
          </p>
        ) : null}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}