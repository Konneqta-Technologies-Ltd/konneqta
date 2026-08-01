/**
 * POST /api/feedback/dismiss — record how the user dismissed the prompt.
 *
 * Body: { action: "maybe_later" | "opt_out" }
 *
 * - "maybe_later" -> sets feedback_last_prompt_at = now + increments count
 *   (via record_feedback_prompt RPC). Re-prompt after 21 days.
 * - "opt_out"     -> sets feedback_opted_out = true (permanent).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "opt_out" ? "opt_out" : "maybe_later";

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

    if (action === "opt_out") {
      await supabase
        .from("profiles")
        .update({
          feedback_opted_out: true,
          feedback_last_prompt_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } else {
      // maybe_later -> record prompt time + increment count atomically.
      const { error } = await supabase.rpc("record_feedback_prompt", {
        p_user_id: user.id,
      });
      if (error) {
        // Fallback if the RPC hasn't been created yet: plain update.
        await supabase
          .from("profiles")
          .update({ feedback_last_prompt_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/feedback/dismiss] error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}