"use client";

import { useEffect, useState } from "react";

import ConnectGuestDialog from "./ConnectGuestDialog";
import { KONNEQT_SOURCES } from "@/lib/konneqts";
import Modal from "@/components/ui/Modal";
import Tooltip from "@/components/Tooltip";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Phase = "idle" | "connecting" | "requested" | "done";

/**
 * ConnectButton — rendered on every profile the visitor doesn't own.
 *
 * Behaviour branches on auth state:
 *   - LOGGED-IN:  Click → confirm dialog → animated "Connect" →
 *                 "Sending…" → sends a Konneqt REQUEST (consent flow).
 *                 The other person Accepts/Rejects from their notification
 *                 panel; only an accept creates the connection.
 *                 States: "Requested" (amber clock — awaiting response),
 *                 "✓ Konneqted" (accepted / already connected).
 *   - ANONYMOUS:  Click → opens ConnectGuestDialog (name/phone/note form).
 *
 * The button is a circular icon button matching the existing Save Contact /
 * Share row styling, with a tooltip.
 *
 * On mount (logged-in) it GETs /api/konneqts/status so returning visitors
 * see the right state: ✓ Konneqted (permanent — one exchange per pair),
 * Requested (pending), or Connect. If the OTHER person already requested
 * the viewer, the button shows Connect and clicking it auto-accepts their
 * request server-side (mutual intent).
 */
export default function ConnectButton({
  targetUsername,
  targetDisplayName,
  source = KONNEQT_SOURCES.PROFILE_PAGE,
}: {
  targetUsername: string;
  targetDisplayName: string;
  source?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string | null;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showGuest, setShowGuest] = useState(false);

  // Resolve auth state and get user's username once on mount.
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return;
      setIsAuthed(!!user);

      if (user) {
        // Fetch the user's profile to get their username
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();
        if (active) {
          setCurrentUser({ username: profile?.username || null });
        }

        // Pre-check the connection state so the button renders the right
        // state for returning visitors (✓ Konneqted / Requested / Connect).
        // Cosmetic only — failures leave the idle state, which the API
        // corrects on click.
        try {
          const res = await fetch(
            `/api/konneqts/status?targetUsername=${encodeURIComponent(targetUsername)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (active) {
              if (data.connected) setPhase("done");
              else if (data.requested) setPhase("requested");
            }
          }
        } catch {
          // ignore — see above.
        }
      }
    });
    return () => {
      active = false;
    };
  }, [targetUsername]);

  const handleClick = () => {
    if (phase === "done" || phase === "requested" || phase === "connecting")
      return;
    if (isAuthed) {
      setShowConfirm(true);
    } else {
      setShowGuest(true);
    }
  };

  const doConnect = async () => {
    setShowConfirm(false);
    setPhase("connecting");
    try {
      const res = await fetch("/api/konneqts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Could not connect. Please try again.");
        setPhase("idle");
        return;
      }
      if (data.status === "konneqted") {
        // Accepted instantly (mutual intent) or already connected — the
        // exchange is complete and can never be repeated.
        setPhase("done");
        // Use a unique toast id so the action button stays clickable.
        // Redirect to current user's own konneqts page, not the target's
        toast.success("You're now Konneqted.", {
          id: "konneqt-success",
          duration: 6000,
          action: {
            label: "View Konneqts",
            onClick: () =>
              currentUser?.username
                ? router.push(`/${currentUser.username}/konneqts`)
                : router.push("/login"),
          },
        });
        return;
      }
      // "requested" | "request_pending" — a request now awaits their
      // decision in the notification panel.
      setPhase("requested");
      toast.success(
        data.status === "request_pending"
          ? "You already have a pending request with this person."
          : "Request sent — we'll let you know when they accept.",
        { id: "konneqt-request", duration: 6000 }
      );
    } catch {
      toast.error("Network error. Please try again.");
      setPhase("idle");
    }
  };

  // The button label/icon changes with the phase. Kept as a small inline
  // render so the Tooltip wrapper stays stable.
  const renderInner = () => {
    if (phase === "connecting") {
      return (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      );
    }
    if (phase === "done") {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    }
    if (phase === "requested") {
      // Awaiting their decision — a clock.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    }
    // idle — a "link/connect" icon (people / handshake style)
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11h-6" />
        <path d="M19 8v6" />
      </svg>
    );
  };

  const label =
    phase === "done"
      ? "Konneqted"
      : phase === "requested"
        ? "Requested"
        : phase === "connecting"
          ? "Connecting…"
          : "Connect";

  return (
    <>
      <Tooltip label={label} side="bottom">
        <button
          type="button"
          onClick={handleClick}
          disabled={phase === "connecting"}
          aria-label={label}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            phase === "done"
              ? "border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
              : phase === "requested"
                ? "border-amber-400 text-amber-600 dark:border-amber-600 dark:text-amber-400"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {renderInner()}
        </button>
      </Tooltip>

      {/* Confirmation dialog (logged-in users only) */}
      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        maxWidthClass="max-w-xs"
        aria-label="Confirm connection"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--main-orange)/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--main-orange)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 11h-6" />
              <path d="M19 8v6" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Send a Konneqt request to {targetDisplayName}?
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {
              "They can accept or reject it from their notifications. Once accepted, you'll each appear in the other's Konneqts."
            }
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="flex-1 cursor-pointer rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doConnect}
              className="flex-1 cursor-pointer rounded-lg bg-(--main-orange) px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Send request
            </button>
          </div>
        </div>
      </Modal>

      {/* Guest dialog (anonymous users) */}
      <ConnectGuestDialog
        open={showGuest}
        onClose={() => setShowGuest(false)}
        targetUsername={targetUsername}
        targetDisplayName={targetDisplayName}
      />
    </>
  );
}