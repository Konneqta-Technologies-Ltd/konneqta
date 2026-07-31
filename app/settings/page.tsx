import DeactivateAccountButton from "@/components/nav/DeactivateAccountButton";
import DeleteAccountButton from "@/components/nav/DeleteAccountButton";
import GoBackButton from "@/components/GoBackButton";
import Link from "next/link";
import type { Metadata } from "next";
import ReactivateAccountButton from "@/components/nav/ReactivateAccountButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Konneqta",
  description: "Manage your Konneqta account settings.",
  robots: { index: false, follow: false },
};

/**
 * Settings page (auth-gated).
 *
 * Houses account-level actions. Currently the main action is Delete Account
 * (moved here from the side drawer so destructive actions live in a dedicated,
 * calmer surface with a confirmation modal).
 */
export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch email + username for display. Email comes from auth (source of
  // truth); username comes from the profiles table.
  const email = user.email ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, status")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? null;
  // status defaults to 'active' when the column/migration doesn't exist yet.
  const isDeactivated = profile?.status === "deactivated";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 pt-20 pb-8 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Settings
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Manage your account
            </p>
          </div>
          <GoBackButton />
        </div>

        {/* Account info card */}
        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Account
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {email || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Username</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {username ? `@${username}` : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Legal */}
        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Legal
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <Link
                href="/privacy"
                className="text-zinc-600 transition-colors hover:text-(--main-orange) dark:text-zinc-400"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-zinc-600 transition-colors hover:text-(--main-orange) dark:text-zinc-400"
              >
                Terms of Use
              </Link>
            </li>
            <li>
              <Link
                href="/refund"
                className="text-zinc-600 transition-colors hover:text-(--main-orange) dark:text-zinc-400"
              >
                Refund Policy
              </Link>
            </li>
          </ul>
        </section>

        {/* Reactivation banner (shown when the account is deactivated) */}
        {isDeactivated && (
          <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Your account is currently deactivated
            </h2>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">
              Your public profile is hidden. Reactivate to make it visible
              again — your data is preserved.
            </p>
            <div className="mt-4">
              <ReactivateAccountButton />
            </div>
          </section>
        )}

        {/* Deactivate account (only shown when active) */}
        {!isDeactivated && (
          <section className="mb-6 rounded-2xl border border-amber-300 bg-white p-5 shadow-sm dark:border-amber-900/60 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Deactivate Account
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Temporarily hide your public profile. You can reactivate at any
              time and your data will be exactly as you left it.
            </p>
            <div className="mt-4 max-w-xs">
              <DeactivateAccountButton />
            </div>
          </section>
        )}

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-300 bg-white p-5 shadow-sm dark:border-red-900/60 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Permanently delete your account and all associated data. This
            action cannot be undone.
          </p>
          <div className="mt-4 max-w-xs">
            <DeleteAccountButton />
          </div>
        </section>
      </div>
    </main>
  );
}