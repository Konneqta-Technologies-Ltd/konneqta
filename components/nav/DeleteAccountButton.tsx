"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Delete Account button — red bg with red shadow, white text.
 *
 * Opens a confirmation modal where the user must type "DELETE" to confirm.
 * On confirm, calls the /api/delete-account route which uses the Supabase
 * service role key to wipe auth + profile + storage data.
 */
export default function DeleteAccountButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!isConfirmed) return;
    setLoading(true);

    try {
      // Clear local supabase session cookies AFTER server deletion succeeds.
      const res = await fetch("/api/delete-account", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out locally to clear the stale JWT from the browser.
      const supabase = createClient();
      await supabase.auth.signOut();

      toast.success("Your account has been deleted.");
      setShowModal(false);
      router.push("/");
    } catch (err) {
      console.error("[delete-account] Error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-400 bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/50 transition-colors hover:bg-red-600"
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
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        Delete Account
      </button>

      {/* ---- Confirmation Modal ---- */}
      {showModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-red-500">Delete Account?</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will permanently erase your profile, social links, QR code,
              and all uploaded images. <strong>This cannot be undone.</strong>
            </p>

            <div className="mt-4">
              <label
                htmlFor="confirm-delete"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Type <span className="font-bold text-red-500">DELETE</span> to
                confirm
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={loading}
                autoComplete="off"
                autoFocus
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="DELETE"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setConfirmText("");
                }}
                disabled={loading}
                className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isConfirmed || loading}
                className="flex-1 cursor-pointer rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}