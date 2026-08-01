"use client";

import { useCallback, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { toast } from "sonner";

type Sentiment = "positive" | "neutral" | "negative";
type Step =
  | "prompt"
  | "sentiment"
  | "category"
  | "context"
  | "comment"
  | "thankyou"
  | "rating";

const POSITIVE_CATEGORIES = [
  "Easy sharing",
  "QR Code",
  "Professional profile",
  "Design",
  "Speed",
  "Other",
];
const NEGATIVE_CATEGORIES = [
  "Design",
  "Performance",
  "Analytics",
  "Customization",
  "Bugs",
  "Other",
];
const CONTEXT_OPTIONS = [
  "Share my profile",
  "Edit my profile",
  "Upgrade",
  "View analytics",
  "Something else",
];

const SESSION_KEY = "kq_feedback_session_shown";

// Text constants — keep apostrophe-containing strings out of JSX so the
// react/no-unescaped-entities linter does not flag them.
const T = {
  promptTitle: "We'd love your feedback",
  promptBody:
    "You've been using Konneqta for a little while. Your feedback helps us improve the experience.",
  dontAsk: "Don't ask me again",
  itsOkay: "It's okay",
  commentQuestion: "Anything else you'd like us to know?",
};

export type FeedbackModalProps = {
  open: boolean;
  /** "modal" = auto-triggered (shows prompt step). "settings" = manual (skips prompt). */
  source: "modal" | "settings";
  onClose: () => void;
};

export default function FeedbackModal({
  open,
  source,
  onClose,
}: FeedbackModalProps) {
  const [step, setStep] = useState<Step>(
    source === "settings" ? "sentiment" : "prompt"
  );
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [context, setContext] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [feedbackId, setFeedbackId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Session start time (for sessionDuration metric). Set lazily - never read
  // during render, only inside the submit handler.
  const sessionStartRef = useRef<number>(0);

  const close = useCallback(() => {
    setStep(source === "settings" ? "sentiment" : "prompt");
    setSentiment(null);
    setCategories([]);
    setContext("");
    setComment("");
    setRating(0);
    setFeedbackId("");
    setError("");
    setSubmitting(false);
    onClose();
  }, [onClose, source]);

  // --- Dismiss handlers (prompt step only) ---
  const handleMaybeLater = useCallback(async () => {
    try {
      await fetch("/api/feedback/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "maybe_later" }),
      });
    } catch {
      // Non-fatal.
    }
    close();
  }, [close]);

  const handleOptOut = useCallback(async () => {
    try {
      await fetch("/api/feedback/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "opt_out" }),
      });
    } catch {
      // Non-fatal.
    }
    close();
  }, [close]);

  // --- Submit feedback ---
  const submitFeedback = useCallback(async () => {
    setSubmitting(true);
    setError("");
    try {
      const sessionMs = Date.now() - sessionStartRef.current;
      const mins = Math.floor(sessionMs / 60000);
      const secs = Math.floor((sessionMs % 60000) / 1000);
      const sessionDuration = `${mins}m ${secs}s`;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentiment,
          category: categories.join(", "),
          context,
          comment,
          featureBeingUsed: context,
          sessionDuration,
          browserOs: navigator.userAgent,
        }),
      });

      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();
      setFeedbackId(data.feedbackId || "");

      // Mark session as shown so the trigger won't re-show within this
      // browser session.
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Non-fatal.
      }

      setStep("thankyou");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [sentiment, categories, context, comment]);

  // --- Category toggle (multi-select) ---
  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const categoryList =
    sentiment === "positive" ? POSITIVE_CATEGORIES : NEGATIVE_CATEGORIES;

  // --- Render helpers ---
  const btnBase =
    "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <Modal
      open={open}
      onClose={close}
      maxWidthClass="max-w-md"
      aria-label="Feedback"
    >
      {/* STEP: PROMPT */}
      {step === "prompt" && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--main-orange)/10 text-2xl">
            {"\uD83D\uDCAC"}
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {T.promptTitle}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {T.promptBody}
          </p>
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => {
                sessionStartRef.current = Date.now();
                setStep("sentiment");
              }}
              className={`${btnBase} bg-(--main-orange) text-white hover:opacity-90`}
            >
              Share Feedback
            </button>
            <button
              type="button"
              onClick={handleMaybeLater}
              className={`${btnBase} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={handleOptOut}
              className={`${btnBase} text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300`}
            >
              {T.dontAsk}
            </button>
          </div>
        </div>
      )}

      {/* STEP: SENTIMENT */}
      {step === "sentiment" && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            How has your experience been?
          </h2>
          <div className="mt-6 space-y-3">
            <SentimentButton
              emoji="😊"
              label="Love it"
              selected={sentiment === "positive"}
              onClick={() => {
                setSentiment("positive");
                setCategories([]);
                setStep("category");
              }}
            />
            <SentimentButton
              emoji="😐"
              label={T.itsOkay}
              selected={sentiment === "neutral"}
              onClick={() => {
                setSentiment("neutral");
                setCategories([]);
                setStep("category");
              }}
            />
            <SentimentButton
              emoji="😕"
              label="Needs improvement"
              selected={sentiment === "negative"}
              onClick={() => {
                setSentiment("negative");
                setCategories([]);
                setStep("category");
              }}
            />
          </div>
        </div>
      )}

      {/* STEP: CATEGORY */}
      {step === "category" && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {sentiment === "positive"
              ? "What do you like most?"
              : "What could we improve?"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Select all that apply
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {categoryList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  categories.includes(cat)
                    ? "bg-(--main-orange) text-white"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("sentiment")}
              className={`${btnBase} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("context")}
              disabled={categories.length === 0}
              className={`${btnBase} flex-1 bg-(--main-orange) text-white hover:opacity-90`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP: CONTEXT */}
      {step === "context" && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            What were you trying to do?
          </h2>
          <div className="mt-4 space-y-2">
            {CONTEXT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setContext(opt)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  context === opt
                    ? "border-(--main-orange) bg-(--main-orange)/5 text-zinc-900 dark:text-zinc-50"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    context === opt
                      ? "border-(--main-orange)"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {context === opt && (
                    <span className="h-2 w-2 rounded-full bg-(--main-orange)" />
                  )}
                </span>
                {opt}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("category")}
              className={`${btnBase} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("comment")}
              disabled={!context}
              className={`${btnBase} flex-1 bg-(--main-orange) text-white hover:opacity-90`}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP: COMMENT */}
      {step === "comment" && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {T.commentQuestion}
          </h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Your thoughts..."
            className="mt-4 w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-(--main-orange) focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div className="mt-1 text-right text-xs text-zinc-400">
            {comment.length}/1000
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("context")}
              disabled={submitting}
              className={`${btnBase} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={submitFeedback}
              disabled={submitting}
              className={`${btnBase} flex-1 bg-(--main-orange) text-white hover:opacity-90`}
            >
              {submitting ? "Sending..." : "Send Feedback"}
            </button>
          </div>
        </div>
      )}

      {/* STEP: THANK YOU */}
      {step === "thankyou" && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-900/30">
            🎉
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Thank you!
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            We read every piece of feedback. Your input helps shape Konneqta.
          </p>
          {feedbackId && (
            <div className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your reference
              </p>
              <p className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {feedbackId}
              </p>
            </div>
          )}
          <div className="mt-6 space-y-2">
            {sentiment === "positive" && (
              <button
                type="button"
                onClick={() => setStep("rating")}
                className={`${btnBase} border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800`}
              >
                Rate your experience ⭐
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className={`${btnBase} bg-(--main-orange) text-white hover:opacity-90`}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* STEP: RATING */}
      {step === "rating" && (
        <div className="text-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Would you recommend Konneqta?
          </h2>
          <div className="mt-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="text-3xl transition-transform hover:scale-110"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <span className={n <= rating ? "" : "grayscale opacity-40"}>
                  ⭐
                </span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="mt-6 space-y-2">
              {rating >= 4 ? (
                <>
                  <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Thanks! Would you be willing to leave a public review?
                  </p>
                  <a
                    href="https://www.google.com/business/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      toast.success("Thank you for your support!");
                      close();
                    }}
                    className={`${btnBase} block bg-(--main-orange) text-white hover:opacity-90`}
                  >
                    Google Business Profile
                  </a>
                  <a
                    href="https://www.linkedin.com/company/konneqta"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      toast.success("Thank you for your support!");
                      close();
                    }}
                    className={`${btnBase} block bg-(--main-orange) text-white hover:opacity-90`}
                  >
                    LinkedIn
                  </a>
                  <button
                    type="button"
                    onClick={close}
                    className={`${btnBase} text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300`}
                  >
                    Not now
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className={`${btnBase} bg-(--main-orange) text-white hover:opacity-90`}
                >
                  Done
                </button>
              )}
            </div>
          )}
          {rating === 0 && (
            <button
              type="button"
              onClick={close}
              className={`${btnBase} mt-6 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300`}
            >
              Skip
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// --- Small helper component ---
function SentimentButton({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
        selected
          ? "border-(--main-orange) bg-(--main-orange)/5"
          : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-zinc-900 dark:text-zinc-50">{label}</span>
    </button>
  );
}