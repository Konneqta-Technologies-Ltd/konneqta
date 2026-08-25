import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/post-login";


    if (code){
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          // Log exchange failures (expired/reused auth code) for debugging —
          // no log line on the happy path.
          console.error("[auth/callback] exchange error:", error.message);
        }
        if (!error){
            return NextResponse.redirect(new URL(next, siteUrl));
        }

    }

    return NextResponse.redirect(new URL("/auth/login", siteUrl))
}