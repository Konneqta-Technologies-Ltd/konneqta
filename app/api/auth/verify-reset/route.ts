import { RESET_COOKIE_NAME, SESSION_TTL_MINUTES } from "@/lib/auth/reset-constants";

import Joi from "joi";
import { NextResponse } from "next/server";
import { verifyReset } from "@/lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            "string.empty": "Email is required",
            "string.email": "Please enter a valid email address",
        }),
    otp: Joi.string()
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            "string.empty": "Code is required",
            "string.pattern.base": "Code must be exactly 6 digits",
        }),
});

/**
 * POST /api/auth/verify-reset
 *
 * Verifies the 6-digit OTP for the given email. On success, creates a
 * DB-backed reset session (password_reset_sessions) and sets its UUID as an
 * httpOnly cookie (`kq_reset_session`, 10-min TTL). The subsequent
 * /api/auth/update-password call reads this cookie to authorize the update.
 */
export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { error: validationError, value } = verifySchema.validate(body, {
        abortEarly: false,
    });

    if (validationError) {
        return NextResponse.json(
            { error: validationError.details[0].message },
            { status: 400 }
        );
    }

    const result = await verifyReset(value.email, value.otp);

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({ verified: true });

    // Set the reset-session cookie (httpOnly, secure in prod, sameSite lax).
    // Expires after SESSION_TTL_MINUTES — the DB row is the source of truth,
    // but syncing the cookie expiry keeps UX consistent.
    response.cookies.set(RESET_COOKIE_NAME, result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_MINUTES * 60,
    });

    return response;
}

/** DELETE /api/auth/verify-reset — clears the reset session cookie. */
export async function DELETE() {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(RESET_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}