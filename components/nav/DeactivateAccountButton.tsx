"use client";

import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearOfflineCardSnapshot } from "@/lib/offline/card-snapshot";

/**
 * Deactivate Account control — the reversible sibling of DeleteAccountButton.
 *
 * Opens a simple confirmation modal (no typing required — deactivation is
 * reversible). On confirm, calls /api/deactivate-account which flips
 * `profiles.status` to 'deactivated' and preserves all data.
 *
 * After success the user is redirected to /settings/deactivated, a calm
 * confirmation page with Reactivate + Sign Out options. They are NOT signed
 * out automatically.
 */
export default function DeactivateAccountButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleClose() {
    if (loading) return;
    setShowModal(false);
  }

  async function handleDeactivate() {
    setLoading(true);

    try {
      const res = await fetch("/api/deactivate-account", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate account");
      }

      // A deactivated profile is hidden from the public — don't leave an
      // offline copy renderable on this device.
      clearOfflineCardSnapshot();

      toast.success("Your account has been deactivated.");
      setShowModal(false);
      router.push("/settings/deactivated");
    } catch (err) {
      console.error("[deactivate-account] Error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate account."
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
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/40 transition-colors hover:bg-amber-600"
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
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        Deactivate Account
      </button>

      <Modal
        open={showModal}
        onClose={handleClose}
        dismissable={!loading}
        aria-label="Deactivate account confirmation"
      >
        <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400">
          Deactivate Account?
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your public profile will be hidden until you reactivate. Your data,
          cards, and subscription are preserved. You can reactivate at any time.
        </p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Spinner size="sm" className="text-white" />}
            {loading ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </Modal>
    </>
  );
}