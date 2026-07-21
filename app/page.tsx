import { redirect } from "next/navigation";
import { resolveActiveCardRedirect } from "@/lib/auth/active-card-redirect";

// force-dynamic: we read the Supabase session here to route logged-in users to
// their active card (and the getUser() call refreshes cookies, which can't
// happen during a streaming RSC response).
export const dynamic = "force-dynamic";

// Root route = the PWA launch target (manifest start_url: "/").
// - Logged-in user  → their active card  (e.g. /john)
// - Logged-in, no profile yet → /onboarding
// - Anonymous visitor → /waitlist (marketing/landing)
export default async function Page() {
  const resolution = await resolveActiveCardRedirect();

  switch (resolution.status) {
    case "anonymous":
      redirect("/waitlist");
    case "onboard":
      redirect("/onboarding");
    case "card":
      redirect(resolution.path);
  }
}