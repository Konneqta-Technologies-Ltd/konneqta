import { createClient } from "@supabase/supabase-js";
import Joi from "joi";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";

import { getCanonicalProfileUrl } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = Joi.object({
    username: Joi.string().pattern(/^[a-z0-9_]{3,20}$/).required(),
    cardId: Joi.string().uuid().required(),
    // Optional logo to composite into the QR center (the caller's final
    // cards.logo_url). Null/absent -> a plain QR, exactly as before.
    logoUrl: Joi.string().uri().allow(null, "").optional(),
});

/**
 * POST /api/onboarding/generate-qr
 *
 * Server-side QR generation for the Konneqta MOBILE app: the qrcode lib can't
 * render to a canvas in React Native, so the app calls this route (with its
 * Supabase access token) right after creating its primary card. Generates the
 * profile QR for the same canonical URL as the web onboarding, uploads it to
 * the qrcodes bucket under the caller's own path, and stores the public URL
 * on the card row (cache-busted so a refresh always replaces the cached
 * copy — same as the web's regenerateQrCode).
 *
 * An optional `logoUrl` is composited into the QR center with sharp — the
 * server-side twin of the web's lib/qr.ts compositeLogo (20% box on a white
 * rounded pad, error correction H) — so the stored PNG that the WEB profile
 * displays carries the logo too, not just the mobile's render-time
 * composite. Any compositing failure keeps the plain QR (the web's
 * graceful-fallback behaviour).
 *
 * Auth: the caller's Supabase access token (Authorization: Bearer) — the
 * client is created with that token so storage/RLS policies apply as the user.
 */
/**
 * Composite a fetched logo into the QR center — the server-side twin of
 * the web's lib/qr.ts compositeLogo(): logo box = 20% of the QR, on a
 * white rounded pad (pad = 12% of the box, radius = 1.2x pad).
 */
async function compositeLogoCenter(qrBuffer: Buffer, logoUrl: string): Promise<Buffer> {
    const size = 480;
    const logoBox = Math.round(size * 0.2);
    const pad = Math.round(logoBox * 0.12);
    const total = logoBox + pad * 2;
    const radius = Math.round(pad * 1.2);
    const logoOrigin = Math.round((size - logoBox) / 2);
    const padOrigin = Math.round((size - total) / 2);

    const res = await fetch(logoUrl);
    if (!res.ok) {
        throw new Error(`Logo fetch failed with status ${res.status}`);
    }
    const logoPng = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(logoBox, logoBox, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();
    const padSvg = Buffer.from(
        `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect x="${padOrigin}" y="${padOrigin}" width="${total}" height="${total}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/></svg>`
    );

    return sharp(qrBuffer)
        .composite([
            { input: padSvg, top: 0, left: 0 },
            { input: logoPng, top: logoOrigin, left: logoOrigin },
        ])
        .png()
        .toBuffer();
}

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

    // Normalized logo (null when absent/empty) — drives ECL + compositing.
    const logoUrl = value.logoUrl ?? null;

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
            // Error correction H when a logo will mask the center
            // (web lib/qr.ts parity) — the code still scans reliably.
            errorCorrectionLevel: logoUrl ? "H" : "M",
            color: { dark: "#18181b", light: "#FFFFFF" },
        });
    } catch (err) {
        console.error("generate-qr: QRCode.toBuffer failed:", err);
        return NextResponse.json(
            { error: "Could not generate the QR code." },
            { status: 500 }
        );
    }

    // Logo composite — the server-side twin of the web's compositeLogo.
    // Any failure keeps the plain QR (graceful fallback, like the web).
    if (logoUrl) {
        try {
            qrBuffer = await compositeLogoCenter(qrBuffer, logoUrl);
        } catch (err) {
            console.warn("generate-qr: logo compositing failed, using plain QR:", err);
        }
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
    // Cache-bust so browsers/the mobile app never show the stale cached
    // PNG after a refresh (same approach as the web's regenerateQrCode).
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
        .from("cards")
        .update({ qr_code_url: publicUrl })
        .eq("id", value.cardId);

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, qrCodeUrl: publicUrl });
}
