import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /konneqts route — redirects authenticated users to their own Konneqts page.
 *
 * This maintains backward compatibility for direct access to /konneqts while
 * ensuring users only see their own connections (not others').
 */
export default async function KonneqtsPage() {
  const supabase = await createClient();

  // --- AUTH GATE ---------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated - redirect to login
    redirect("/auth/login");
  }

  // Get the user's profile to get their username
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // Redirect to the user's own konneqts page
  if (profile?.username) {
    redirect(`/${profile.username}/konneqts`);
  }

  // Fallback - if no username, redirect to login
  redirect("/auth/login");
}