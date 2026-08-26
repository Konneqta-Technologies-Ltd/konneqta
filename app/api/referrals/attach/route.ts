/**
 * POST /api/referrals/attach — attach a referral code to the caller's account.
 *
 * Body: { code: string }
 *
 * Called:
 *   - automatically at the end of onboarding (fire-and-forget) with the code
 *     stashed from a ?ref= link or typed into the optional onboarding field
 *   - manually from the /referral page ("Have a referral code?" form) for
 *     existing free users who signed up before this feature
 *
 * All rules are enforced in lib/referrals/service.ts (service role):
 *   code exists · not self-referral · one referrer per account ·
 *   no successful payment yet (code must be attached BEFORE subscribing).
 */

import { attachReferral } from "@/lib/referrals/service";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code : "";

    if (!rawCode.trim()) {
      return NextResponse.json(
        { error: "Missing referral code.", reason: "invalid_code" },
        { status: 400 }
      );
    }

    // --- Auth: verify the caller's session via cookie ----------------------
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
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // --- Attach (service role — referrals has no user-write policies) ------
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const result = await attachReferral({
      admin,
      referredUserId: user.id,
      rawCode,
    });

    if (result.ok) {
      return NextResponse.json({ ok: true });
    }

    const messages: Record<string, { error: string; status: number }> = {
      invalid_code: {
        error: "Referral code not found. Check the code and try again.",
        status: 404,
      },
      self_referral: {
        error: "You can't refer yourself with your own code.",
        status: 400,
      },
      already_referred: {
        error: "This account already has a referrer.",
        status: 409,
      },
      already_paid: {
        error:
          "Referral codes can only be applied before your first subscription payment.",
        status: 409,
      },
      error: {
        error: "Something went wrong applying the code. Please try again.",
        status: 500,
      },
    };

    const fallback = messages.error;
    const mapped = (result.reason && messages[result.reason]) || fallback;

    return NextResponse.json(
      { error: mapped.error, reason: result.reason },
      { status: mapped.status }
    );
  } catch (err) {
    console.error("[api/referrals/attach] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
