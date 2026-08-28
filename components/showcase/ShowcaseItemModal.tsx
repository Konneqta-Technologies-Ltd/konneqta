"use client";

import LoadingButton from "@/components/ui/LoadingButton";
import Modal from "@/components/ui/Modal";
import { compressImage, SHOWCASE_OPTIONS } from "@/lib/image";
import {
  extractShowcaseStoragePath,
  sanitizeShowcaseText,
  SHOWCASE_DESCRIPTION_MAX_CHARS,
  SHOWCASE_IMAGE_MAX_BYTES,
  SHOWCASE_NAME_MAX_CHARS,
  SHOWCASE_PRICE_MAX_CHARS,
  type ShowcaseItem,
} from "@/lib/showcase";
import { ALLOWED_IMAGE_TYPES, safeFileExtension } from "@/lib/url-validation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

/** Shared input styling (matches EditProfileForm / OnboardingForm). */
const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500";

/**
 * Add/Edit showcase item modal.
 *
 * MOUNTED ONLY WHILE OPEN — the parent conditionally renders it, so all form
 * state initializes fresh from `editing` on every open (no populate effect,
 * per react-hooks/set-state-in-effect). Closing = unmounting = clean slate.
 *
 * NOT dismissable by backdrop-click or Escape (ui/Modal `dismissable={false}`)
 * — per spec it closes ONLY via the top X or the Cancel button, so an
 * accidental tap can never throw away a half-filled form.
 *
 * Validation ("secured inputs"):
 *  - name: REQUIRED — Save stays disabled (with a stated reason) until
 *    non-empty; sanitized (control chars stripped, trimmed).
 *  - image: optional; JPG/PNG/WebP only; the ORIGINAL file must be ≤ 2MB —
 *    the error states the limit AND the picked size. Compression to
 *    SHOWCASE_OPTIONS happens after the check (canvas re-encode also strips
 *    EXIF/GPS metadata).
 *  - price/description: optional free text, length-capped (DB CHECKs are the
 *    backstop; maxLength attrs give fast feedback).
 *
 * Storage: uploads to the owner-scoped `showcase` bucket at
 * `<userId>/showcase-<ts>.<ext>`; replaced/removed images are orphan-cleaned
 * via extractShowcaseStoragePath, and URLs get a ?t= cache-buster so a new
 * image never serves stale from the browser/CDN (the avatar fix).
 */
export default function ShowcaseItemModal({
  open,
  onClose,
  onSaved,
  cardId,
  editing,
  nextPosition,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the saved row so the parent updates its list in place. */
  onSaved: (item: ShowcaseItem) => void;
  cardId: string;
  /** The item being edited, or null when adding a new one. */
  editing: ShowcaseItem | null;
  /** `position` assigned to a NEW item (the current item count). */
  nextPosition: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Fresh state on every mount (parent only mounts this while open) — the
  // useState initializers read `editing`, replacing the old populate effect.
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(editing?.price ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(editing?.image_url ?? "");
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);

  // Revoke blob object URLs when the preview changes / on unmount. Storage
  // URLs (edit mode) aren't blobs — revoking them is a no-op, so this is safe.
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const rejectImage = (message: string) => {
    setImageError(message);
    toast.error(message);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      rejectImage("Image must be a JPG, PNG, or WebP file");
      return;
    }
    // 2MB cap on the ORIGINAL file — compression happens after this check.
    if (file.size > SHOWCASE_IMAGE_MAX_BYTES) {
      const pickedMb = (file.size / (1024 * 1024)).toFixed(1);
      rejectImage(`Image must be less than 2MB — you picked ${pickedMb}MB`);
      return;
    }
    const compressed = await compressImage(file, SHOWCASE_OPTIONS);
    setImageFile(compressed);
    setImagePreview(URL.createObjectURL(compressed));
    setImageRemoved(false);
    setImageError("");
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    const cleanName = sanitizeShowcaseText(name);
    if (!cleanName) return; // Save is disabled in this state anyway.
    const cleanPrice = sanitizeShowcaseText(price);
    const cleanDescription = sanitizeShowcaseText(description, {
      multiline: true,
    });

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save showcase items");
        return;
      }

      // 1. Upload the new image (if picked) + orphan-clean the previous one.
      let imageUrl = editing?.image_url ?? null;
      if (imageFile) {
        const fileExt = safeFileExtension(imageFile.name);
        const filePath = `${user.id}/showcase-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("showcase")
          .upload(filePath, imageFile, { upsert: true });
        if (uploadError) {
          toast.error(uploadError.message);
          return;
        }
        const { data } = supabase.storage
          .from("showcase")
          .getPublicUrl(filePath);
        // ?t= cache-buster: browsers/CDN must not serve the previous image.
        imageUrl = `${data.publicUrl}?t=${Date.now()}`;

        if (editing?.image_url) {
          const oldPath = extractShowcaseStoragePath(editing.image_url);
          if (oldPath) {
            await supabase.storage
              .from("showcase")
              .remove([oldPath])
              .catch(() => {});
          }
        }
      } else if (imageRemoved && editing?.image_url) {
        const oldPath = extractShowcaseStoragePath(editing.image_url);
        if (oldPath) {
          await supabase.storage
            .from("showcase")
            .remove([oldPath])
            .catch(() => {});
        }
        imageUrl = null;
      }

      // 2. Insert / update the row.
      const fields = {
        name: cleanName,
        description: cleanDescription || null,
        price: cleanPrice || null,
        image_url: imageUrl,
      };

      let saved: ShowcaseItem;
      if (editing) {
        const { data, error } = await supabase
          .from("showcase_items")
          .update({ ...fields, position: editing.position })
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        saved = data as ShowcaseItem;
        toast.success("Item updated");
      } else {
        const { data, error } = await supabase
          .from("showcase_items")
          .insert({ ...fields, card_id: cardId, position: nextPosition })
          .select()
          .single();
        if (error) throw new Error(error.message);
        saved = data as ShowcaseItem;
        toast.success("Item added to your showcase");
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      // The DB limit trigger raises "Showcase item limit reached." —
      // surface it as a friendly upgrade prompt.
      if (message.toLowerCase().includes("limit")) {
        toast.error("Showcase limit reached — upgrade to Pro to add more items.");
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const nameEmpty = !name.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={false}
      maxWidthClass="max-w-md"
      aria-label={editing ? "Edit showcase item" : "Add showcase item"}
    >
      {/* Header + X — the ONLY dismiss affordances are this X and Cancel. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {editing ? "Edit item" : "Add an item"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Only the name is required — image, price and description are
            optional.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={saving}
          className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
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

      {/* Image picker */}
      <div className="mt-4">
        {imagePreview ? (
          <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Item image preview"
              className="h-40 w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-(--main-orange) hover:text-(--main-orange) disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="text-xs font-medium">Add image</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              JPG, PNG or WebP · up to 2MB
            </span>
          </button>
        )}
        {imageError ? (
          <p className="mt-1.5 text-xs font-medium text-red-500">{imageError}</p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>

      {/* Fields */}
      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="showcase-item-name"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Item name <span className="text-(--main-orange)">*</span>
          </label>
          <input
            id="showcase-item-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={SHOWCASE_NAME_MAX_CHARS}
            placeholder="e.g. Handmade leather bag"
            className={inputClassName}
          />
          {nameEmpty ? (
            <p className="mt-1 text-[11px] text-red-500">
              Item name is required — Save stays disabled until you add one.
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="showcase-item-price"
            className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Price (optional)
          </label>
          <input
            id="showcase-item-price"
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            maxLength={SHOWCASE_PRICE_MAX_CHARS}
            placeholder="e.g. ₦25,000 · $30/month · Free"
            className={inputClassName}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="showcase-item-description"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
            >
              Description (optional)
            </label>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {description.length}/{SHOWCASE_DESCRIPTION_MAX_CHARS}
            </span>
          </div>
          <textarea
            id="showcase-item-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={SHOWCASE_DESCRIPTION_MAX_CHARS}
            rows={3}
            placeholder="A short pitch for this product or service…"
            className={`${inputClassName} resize-none`}
          />
        </div>
      </div>

      {/* Actions — Cancel + Save Item, both full width */}
      <div className="mt-5 flex gap-3">
        <LoadingButton
          variant="outline"
          fullWidth
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </LoadingButton>
        <LoadingButton
          fullWidth
          onClick={handleSave}
          loading={saving}
          loadingText="Saving…"
          disabled={nameEmpty}
        >
          Save Item
        </LoadingButton>
      </div>
    </Modal>
  );
}