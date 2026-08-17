import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * /konneqts route — redirects authenticated users to their own Konneqts page.
 *
 * This maintains backward compatibility for direct access to /konneqts while
 * ensuring users only see their own connections (not others').
 */

// This is a private, auth-gated router (never renders content) — keep it out
// of search indexes entirely rather than self-canonicalizing.
export const metadata: Metadata = {
  title: "Konneqts · Konneqta",
  robots: { index: false, follow: false },
};

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