"use client";

import Spinner from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Client-side action buttons for the post-deactivation page.
 * - Reactivate: POSTs /api/reactivate-account, then routes to the user's
 *   profile. No extra onboarding — one click and they're back.
 * - Sign Out: clears the local session and sends them home.
 */
export default function DeactivatedActions() {
  const router = useRouter();
  const [reactivating, setReactivating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleReactivate() {
    setReactivating(true);
    try {
      const res = await fetch("/api/reactivate-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate account");
      }
      toast.success("Welcome back! Your account is active again.");
      // Go to post-login resolver — it'll route to the user's active card.
      router.push("/post-login");
    } catch (err) {
      console.error("[reactivate] Error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to reactivate account."
      );
    } finally {
      setReactivating(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("[sign-out] Error:", err);
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={handleReactivate}
        disabled={reactivating || signingOut}
        className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl bg-(--main-orange) px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {reactivating && <Spinner size="sm" className="text-white" />}
        {reactivating ? "Reactivating…" : "Reactivate"}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={reactivating || signingOut}
        className="flex w-full items-center justify-center gap-2 cursor-pointer rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {signingOut && <Spinner size="sm" />}
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </div>
  );
}