import Joi from "joi";
import { NextResponse } from "next/server";
import { RESET_COOKIE_NAME } from "@/lib/auth/reset-constants";
import { updatePassword } from "@/lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const passwordSchema = Joi.object({
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            "string.empty": "Password is required",
            "string.min": "Password must be at least 6 characters",
        }),
    confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "string.empty": "Please confirm your password",
            "any.only": "Passwords do not match",
        }),
});

/**
 * POST /api/auth/update-password
 *
 * Reads the `kq_reset_session` cookie (set by /api/auth/verify-reset), looks up
 * the corresponding DB reset session, and — if valid — updates the user's
 * password via the Supabase admin API (service role). Invalidates the session
 * afterward so it can't be reused, and clears the cookie.
 */
export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { error: validationError, value } = passwordSchema.validate(body, {
        abortEarly: false,
    });

    if (validationError) {
        return NextResponse.json(
            { error: validationError.details[0].message },
            { status: 400 }
        );
    }

    const sessionId = request.headers.get("cookie")
        ?.split("; ")
        .find((c) => c.startsWith(`${RESET_COOKIE_NAME}=`))
        ?.split("=")[1];

    const result = await updatePassword(sessionId, value.password);

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Success: clear the reset-session cookie.
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