"use client";

import Modal from "@/components/ui/Modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * ConnectGuestDialog — the form an anonymous visitor fills in when they click
 * "Connect" on a Konneqta profile.
 *
 * Two screens:
 *   1. Form: Name (required), Phone (optional), Short note (optional).
 *   2. Success: "You're all set!" + prompt to create their own card → /signup.
 *
 * The form is intentionally short — the goal is the lowest possible friction
 * for a non-user to share their details with the profile owner.
 */
export default function ConnectGuestDialog({
  open,
  onClose,
  targetUsername,
  targetDisplayName,
}: {
  open: boolean;
  onClose: () => void;
  targetUsername: string;
  targetDisplayName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setNote("");
    setSubmitting(false);
    setDone(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/konneqts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername,
          source: "GUEST_FORM",
          guestName: name.trim(),
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidthClass="max-w-md"
      aria-label="Connect with this profile"
    >
      {!done ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Connect with {targetDisplayName}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Share your details so they can reach out to you.
            </p>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="guest-name"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="guest-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-(--main-orange) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={submitting}
              autoFocus
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="guest-phone"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Phone <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="guest-phone"
              type="tel"
              maxLength={60}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 890"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-(--main-orange) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={submitting}
            />
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="guest-note"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Short note <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="guest-note"
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Hi! I'd love to connect…"
              className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-(--main-orange) dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={submitting}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Share my details"}
            </button>
          </div>
        </form>
      ) : (
        /* ---- Success screen ---- */
        <div className="text-center">
          {/* Success checkmark */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={28}
              height={28}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {"You're all set!"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Your details have been shared with {targetDisplayName}.
          </p>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Would you like your own Konneqta profile too?
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Create a free digital card and share it with one tap or scan.
          </p>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="w-full cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Create My Card
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}