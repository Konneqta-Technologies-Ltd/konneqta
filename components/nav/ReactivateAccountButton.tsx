"use client";

import Spinner from "@/components/ui/Spinner";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Inline "Reactivate" button for the Settings page banner shown to
 * deactivated users. One click → POST /api/reactivate-account → route to the
 * user's profile. No extra onboarding.
 */
export default function ReactivateAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReactivate() {
    setLoading(true);
    try {
      const res = await fetch("/api/reactivate-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate account");
      }
      toast.success("Welcome back! Your account is active again.");
      router.push("/post-login");
    } catch (err) {
      console.error("[reactivate] Error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to reactivate account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReactivate}
      disabled={loading}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Spinner size="sm" className="text-white" />}
      {loading ? "Reactivating…" : "Reactivate"}
    </button>
  );
}