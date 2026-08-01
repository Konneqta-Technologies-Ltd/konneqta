"use client";

import { useEffect, useRef, useState } from "react";

import FeedbackModal from "./FeedbackModal";

const SESSION_KEY = "kq_feedback_session_shown";
// Delay before the first eligibility check (ms). Avoids hammering the API
// on instant page bounces + gives the page time to settle.
const INITIAL_DELAY_MS = 8000;

/**
 * Auto-triggers the feedback modal for eligible, authenticated users.
 *
 * Mounted inside AppNavbar (which already hides itself on legal/auth/waitlist
 * routes), so this only runs on authenticated app pages.
 *
 * Checks:
 *   1. Has the user already seen the prompt this browser session?
 *   2. Is the user eligible (via /api/feedback/eligibility)?
 * If both pass, opens the modal.
 */
export default function FeedbackTrigger() {
  const [open, setOpen] = useState(false);
  // useRef gate prevents duplicate timers across re-renders without
  // triggering cascading setState in the effect body.
  const startedRef = useRef(false);

  useEffect(() => {
    // Don't run on the server.
    if (typeof window === "undefined") return;

    // Guard against double-invocation (Strict Mode in dev).
    if (startedRef.current) return;
    startedRef.current = true;

    // Don't show if already shown in this browser session.
    let skip = false;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        skip = true;
      }
    } catch {
      // Non-fatal.
    }

    if (skip) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/feedback/eligibility");
        if (!res.ok) return;
        const data = await res.json();
        if (data.eligible === true) {
          setOpen(true);
        }
      } catch {
        // Non-fatal — never block the page.
      }
    }, INITIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <FeedbackModal
      open={open}
      source="modal"
      onClose={() => setOpen(false)}
    />
  );
}