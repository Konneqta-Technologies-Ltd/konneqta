/**
 * GET /api/feedback/eligibility — check if the feedback prompt should show.
 *
 * Returns: { eligible, score, threshold, optedOut, daysSincePrompt,
 *            daysSinceSubmitted, reason }
 *
 * Called by FeedbackTrigger on authenticated pages after a short delay.
 */

import { NextResponse } from "next/server";
import { checkEligibility } from "@/lib/feedback/eligibility";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { eligible: false, reason: "unauthenticated" },
        { status: 401 }
      );
    }

    const result = await checkEligibility(supabase, user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/feedback/eligibility] error:", err);
    // Non-fatal — don't block the UX.
    return NextResponse.json({ eligible: false, reason: "error" });
  }
}