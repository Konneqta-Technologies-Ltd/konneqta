"use client";

import FeedbackModal from "@/components/feedback/FeedbackModal";
import { useState } from "react";

/**
 * Client button that opens the feedback modal from the Settings page.
 * Unlike the auto-trigger (FeedbackTrigger), this is always available
 * and skips the prompt step.
 */
export default function FeedbackSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Share Feedback
      </button>
      <FeedbackModal
        open={open}
        source="settings"
        onClose={() => setOpen(false)}
      />
    </>
  );
}