"use client";

import Spinner from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTrack } from "@/lib/use-track";
import { clearOfflineCardSnapshot } from "@/lib/offline/card-snapshot";

/**
 * Logout button — orange bg, white text.
 *
 * Calls supabase.auth.signOut() which invalidates the JWT on the server,
 * terminating all sessions for this user (not just the current device).
 * Then routes to "/" (home).
 */
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const track = useTrack();

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      toast.error("Failed to log out. Please try again.");
      return;
    }

    // Remove the offline card snapshot — a logged-out device must never be
    // able to view the owner's saved card offline.
    clearOfflineCardSnapshot();

    track("user_logged_out");
    toast.success("Logged out successfully");
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-(--main-orange) px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
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
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
      {loading ? "Logging out…" : "Log Out"}
    </button>
  );
}