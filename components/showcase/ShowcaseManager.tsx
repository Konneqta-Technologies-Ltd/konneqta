"use client";

import LoadingButton from "@/components/ui/LoadingButton";
import Modal from "@/components/ui/Modal";
import { PLAN_LIMITS } from "@/lib/entitlements";
import { extractShowcaseStoragePath, type ShowcaseItem } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

import ShowcaseItemModal from "./ShowcaseItemModal";
import ShowcaseItemRow from "./ShowcaseItemRow";

/**
 * Owner-side showcase manager — the heart of app/[username]/showcase.
 *
 * - Empty state: orange rounded container + white plus, "Add an Item" —
 *   per spec both the icon AND the heading are clickable.
 * - Items render via ShowcaseItemRow: single-column list on mobile, grid on
 *   larger screens. Each row's chevron opens an Edit/Delete menu.
 * - "Add New Item" appears at the bottom once at least one item exists. At
 *   the plan cap it becomes a padlocked upgrade slot (the ProGate
 *   philosophy: showing the locked feature converts better than hiding it).
 * - Delete asks for confirmation — destructive actions are never one tap.
 * - Writes go straight to Supabase; RLS + the limit trigger are the real
 *   gates, `maxItems` here only shapes the UI.
 */
export default function ShowcaseManager({
  initialItems,
  cardId,
  maxItems,
}: {
  initialItems: ShowcaseItem[];
  cardId: string;
  /** Free = 2, Pro = 10, exempt = Infinity. Read side — the DB enforces. */
  maxItems: number;
}) {
  const [items, setItems] = useState<ShowcaseItem[]>(initialItems);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ShowcaseItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const hasCap = Number.isFinite(maxItems);
  const atCap = hasCap && items.length >= maxItems;

  const handleAdd = () => {
    if (atCap) {
      toast.error(
        `Your plan allows up to ${maxItems} showcase items. Upgrade to Pro for ${PLAN_LIMITS.pro.maxShowcaseItems}.`,
      );
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (item: ShowcaseItem) => {
    setMenuOpenId(null);
    setEditing(item);
    setModalOpen(true);
  };

  const handleSaved = (saved: ShowcaseItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === saved.id)
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [...prev, saved],
    );
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("showcase_items")
        .delete()
        .eq("id", deleting.id);
      if (error) throw new Error(error.message);

      // Orphan cleanup: the row is gone, its image shouldn't linger.
      if (deleting.image_url) {
        const oldPath = extractShowcaseStoragePath(deleting.image_url);
        if (oldPath) {
          await supabase.storage
            .from("showcase")
            .remove([oldPath])
            .catch(() => {});
        }
      }

      setItems((prev) => prev.filter((i) => i.id !== deleting.id));
      toast.success("Item deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete the item",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      {items.length === 0 ? (
        /* ---- Empty state: orange box + white plus, "Add an Item" — both
           the icon AND the heading are clickable (single <button>, spans
           inside so the markup stays valid). ---- */
        <div className="flex flex-col items-center py-14 text-center">
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Add an item to your showcase"
            className="group flex cursor-pointer flex-col items-center"
          >
            <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-(--main-orange) text-white shadow-lg transition-transform group-hover:scale-105 group-active:scale-95">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </span>
            <span className="mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Add an Item
            </span>
          </button>
          <p className="mt-1.5 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Curate your showcase to highlight your best products and services.
          </p>
        </div>
      ) : (
        <>
          {/* Plan counter */}
          <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {items.length}
            {hasCap ? ` of ${maxItems}` : ""} {items.length === 1 ? "item" : "items"}
          </p>

          {/* Items — single-column list on mobile, grid on larger screens.
              Each row's chevron opens an Edit/Delete menu. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ShowcaseItemRow
                key={item.id}
                item={item}
                actions={
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setMenuOpenId(menuOpenId === item.id ? null : item.id)
                      }
                      aria-label={`Options for ${item.name}`}
                      aria-expanded={menuOpenId === item.id}
                      className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>

                    {menuOpenId === item.id ? (
                      <>
                        {/* Click-away shield */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpenId(null)}
                        />
                        <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                            Edit item
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              setDeleting(item);
                            }}
                            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete item
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                }
              />
            ))}
          </div>

          {/* Add New Item — or, at the plan cap, the padlocked upgrade slot
              (the ProGate philosophy: show the locked feature, don't hide
              it; tapping it toasts the upgrade prompt). */}
          <div className="mt-5">
            {atCap ? (
              <button
                type="button"
                onClick={handleAdd}
                aria-label="Showcase full — upgrade to Pro for more items"
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Showcase full — {items.length} of {maxItems} items
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    Upgrade to Pro for {PLAN_LIMITS.pro.maxShowcaseItems} items.
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-(--main-orange) px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Add New Item
              </button>
            )}
          </div>
        </>
      )}

      {/* Add/Edit modal — mounted ONLY while open so its form state resets
          fresh from `editing` on every open (see ShowcaseItemModal docs). */}
      {modalOpen && (
        <ShowcaseItemModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
          cardId={cardId}
          editing={editing}
          nextPosition={items.length}
        />
      )}

      {/* Delete confirmation — destructive actions are never one tap */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        aria-label="Delete showcase item"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Delete this item?
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          “{deleting?.name}” will be permanently removed from your showcase.
        </p>
        <div className="mt-6 flex gap-3">
          <LoadingButton
            variant="secondary"
            fullWidth
            onClick={() => setDeleting(null)}
            disabled={deleteBusy}
          >
            Cancel
          </LoadingButton>
          <LoadingButton
            variant="danger"
            fullWidth
            onClick={handleDelete}
            loading={deleteBusy}
            loadingText="Deleting…"
          >
            Delete
          </LoadingButton>
        </div>
      </Modal>
    </div>
  );
}