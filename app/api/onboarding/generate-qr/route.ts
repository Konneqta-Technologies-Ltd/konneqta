import { createClient } from "@supabase/supabase-js";
import Joi from "joi";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { getCanonicalProfileUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = Joi.object({
    username: Joi.string().pattern(/^[a-z0-9_]{3,20}$/).required(),
    cardId: Joi.string().uuid().required(),
});

/**
 * POST /api/onboarding/generate-qr
 *
 * Server-side QR generation for the Konneqta MOBILE app: the qrcode lib can't
 * render to a canvas in React Native, so the app calls this route (with its
 * Supabase access token) right after creating its primary card. Generates the
 * profile QR for the same canonical URL as the web onboarding, uploads it to
 * the qrcodes bucket under the caller's own path, and stores the public URL
 * on the card row.
 *
 * Auth: the caller's Supabase access token (Authorization: Bearer) — the
 * client is created with that token so storage/RLS policies apply as the user.
 */
export async function POST(request: Request) {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ error: "Server not configured." }, { status: 500 });
    }

    // Client acts as the caller — ownership checks + RLS apply normally.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const user = userData.user;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { error: validationError, value } = payloadSchema.validate(body, {
        abortEarly: false,
    });
    if (validationError) {
        return NextResponse.json(
            { error: validationError.details[0].message },
            { status: 400 }
        );
    }

    // Ownership check — the card must belong to the caller.
    const { data: card } = await supabase
        .from("cards")
        .select("id")
        .eq("id", value.cardId)
        .eq("owner_id", user.id)
        .maybeSingle();
    if (!card) {
        return NextResponse.json({ error: "Card not found." }, { status: 403 });
    }

    // Same canonical URL the web onboarding encodes.
    const profileUrl = getCanonicalProfileUrl(value.username);

    let qrBuffer: Buffer;
    try {
        qrBuffer = await QRCode.toBuffer(profileUrl, {
            margin: 2,
            width: 480,
            errorCorrectionLevel: "M",
            color: { dark: "#18181b", light: "#FFFFFF" },
        });
    } catch (err) {
        console.error("generate-qr: QRCode.toBuffer failed:", err);
        return NextResponse.json(
            { error: "Could not generate the QR code." },
            { status: 500 }
        );
    }

    const path = `${user.id}/${value.cardId}/qr.png`;
    const { error: uploadError } = await supabase.storage
        .from("qrcodes")
        .upload(path, qrBuffer, { upsert: true, contentType: "image/png" });

    if (uploadError) {
        console.error("generate-qr: upload failed:", uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("qrcodes").getPublicUrl(path);

    const { error: updateError } = await supabase
        .from("cards")
        .update({ qr_code_url: data.publicUrl })
        .eq("id", value.cardId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, qrCodeUrl: data.publicUrl });
}
