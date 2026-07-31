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
        console.log("Exchange error:", error?.message ?? "none");
        if (!error){
            return NextResponse.redirect(new URL(next, siteUrl));
        }

    }

    return NextResponse.redirect(new URL("/auth/login", siteUrl))
}