import Joi from "joi";
import { NextResponse } from "next/server";
import { requestReset } from "@/lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email address",
        }),
});

/**
 * POST /api/auth/request-reset
 *
 * Generates a 6-digit OTP, HMAC-hashes it, stores it in password_reset_tokens,
 * and emails it via ZeptoMail (security@konneqta.com).
 *
 * Anti-enumeration: always returns { ok: true } regardless of whether the
 * email belongs to an existing user. Rate-limited by both email (1/min) and
 * IP (5/min).
 */
export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { error: validationError, value } = emailSchema.validate(body, {
        abortEarly: false,
    });

    if (validationError) {
        return NextResponse.json(
            { error: validationError.details[0].message },
            { status: 400 }
        );
    }

    // Derive the client IP for rate-limiting. We support a custom header that
    // proxies/front ends may set, then fall back to standard headers.
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || null;

    try {
        await requestReset(value.email, ip);
        // Always return ok to prevent user enumeration.
        return NextResponse.json({ ok: true });
    } catch (err) {
         console.error("========== REQUEST RESET ERROR ==========");
    console.error(err);
      return NextResponse.json(
        {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        },
        { status: 500 }
    )
    }
}