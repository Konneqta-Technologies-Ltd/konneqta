import DeactivatedActions from "./DeactivatedActions";
import GoBackButton from "@/components/GoBackButton";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Deactivated · Konneqta",
  description: "Your account has been deactivated.",
  robots: { index: false, follow: false },
};

/**
 * Post-deactivation landing page.
 *
 * Reached immediately after a user deactivates their account, OR when a
 * deactivated user logs back in (via the post-login redirect). Reassures them
 * that their data is safe and their profile is hidden, and offers two paths:
 * Reactivate (one click, no onboarding) or Sign Out.
 */
export default async function DeactivatedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <GoBackButton />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Your account has been deactivated
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Your public profile is hidden. Your data, cards, and subscription
            are preserved. You can reactivate at any time.
          </p>

          <DeactivatedActions />
        </div>
      </div>
    </main>
  );
}