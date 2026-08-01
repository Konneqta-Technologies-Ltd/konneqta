import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "crypto";

import { createAdminClient } from "@/lib/auth/admin";

/**
 * Custom password-reset OTP flow.
 *
 * Flow:
 *   requestReset(email, ip)   → 6-digit OTP, HMAC-hashed, stored, emailed
 *   verifyReset(email, otp)   → verify OTP → create DB reset session → return sessionId
 *   updatePassword(sessionId) → look up session → admin.updateUserById → invalidate session
 *
 * The reset "permission" is a DB row (password_reset_sessions) identified by a
 * UUID stored in an httpOnly cookie. No JWT. DB-backed = instantly revocable.
 */

const OTP_TTL_MINUTES = 10;
const SESSION_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const EMAIL_RATE_LIMIT_SECONDS = 60;
const IP_RATE_LIMIT_MAX = 5;
const IP_RATE_LIMIT_SECONDS = 60;
const OTP_LENGTH = 6;

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------
function getOtpSecret(): string {
    const secret = process.env.OTP_HMAC_SECRET;
    if (!secret) {
        throw new Error("OTP_HMAC_SECRET environment variable is not set.");
    }
    return secret;
}

/** HMAC-SHA256 the OTP. Fast + irreversible; safe for short-lived codes. */
function hashOtp(otp: string): string {
    return createHmac("sha256", getOtpSecret()).update(otp).digest("hex");
}

/** Constant-time comparison of two hex digests. */
function safeEqualHex(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

function generateOtp(): string {
    // randomInt is inclusive on both bounds → 0..999999
    return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, "0");
}

// ---------------------------------------------------------------------------
// requestReset
// ---------------------------------------------------------------------------
export interface RequestResetResult {
    ok: true;
}

export async function requestReset(
    email: string,
    ipAddress: string | null
): Promise<RequestResetResult> {
    const normalizedEmail = email.trim().toLowerCase();
    console.log("1. Creating admin client...");
    const supabase = createAdminClient();
    console.log("2.  admin client created...");
    const now = new Date();

    // --- Rate limit: 1 request per email per 60s ---
    const { count: emailCount } = await supabase
        .from("password_reset_tokens")
        .select("id", { count: "exact", head: true })
        .eq("email", normalizedEmail)
        .gte("created_at", new Date(now.getTime() - EMAIL_RATE_LIMIT_SECONDS * 1000).toISOString());

    if ((emailCount ?? 0) >= 1) {
        // Silently succeed to avoid enumeration — no email is sent.
        return { ok: true };
    }

    // --- Rate limit: 5 requests per IP per 60s ---
    if (ipAddress) {
        const { count: ipCount } = await supabase
            .from("password_reset_tokens")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ipAddress)
            .gte("created_at", new Date(now.getTime() - IP_RATE_LIMIT_SECONDS * 1000).toISOString());

        if ((ipCount ?? 0) >= IP_RATE_LIMIT_MAX) {
            return { ok: true };
        }
    }

    // --- Look up the user (silently skip if unknown — no enumeration) ---
    console.log("3. Listing users...");

const { data: userList, error: listUsersError } =
    await supabase.auth.admin.listUsers();

console.log("listUsersError:", listUsersError);

if (listUsersError) {
    throw listUsersError;
}

console.log("4. Users loaded:", userList.users.length);
    const user = userList?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

    // --- Invalidate all previous unused OTPs for this email ---
    await supabase
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("email", normalizedEmail)
        .eq("used", false);

    // Only generate + store + email if the user actually exists.
    if (user) {
        const otp = generateOtp();
        const otpHash = hashOtp(otp);
        const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);


        console.log("5. Inserting reset token...");

        const {error: insertError} =await supabase
        .from("password_reset_tokens")
        .insert({
            email: normalizedEmail,
            user_id: user.id,
            otp_hash: otpHash,
            ip_address: ipAddress,
            expires_at: expiresAt.toISOString(),
        });


if (insertError) {
    console.error("Insert error:", insertError);
    throw insertError;
}

console.log("6. Token inserted");
        // Send the email (imported lazily so the browser bundle never sees it).
        const { sendPasswordResetOtp } = await import("@/lib/emails/zeptomail");
        console.log('7. Sending Zepto email')
        await sendPasswordResetOtp(user.email!, user.email!, otp);

        console.log('8. Email sent')
    }

    return { ok: true };
}

// ---------------------------------------------------------------------------
// verifyReset
// ---------------------------------------------------------------------------
export interface VerifyResetSuccess {
    sessionId: string;
    userId: string;
}
export interface VerifyResetFailure {
    error: string;
}
export type VerifyResetResult = VerifyResetSuccess | VerifyResetFailure;

export async function verifyReset(
    email: string,
    otp: string
): Promise<VerifyResetResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Latest unused, unexpired OTP for this email.
    const { data: token } = await supabase
        .from("password_reset_tokens")
        .select("id, user_id, otp_hash, attempts, expires_at")
        .eq("email", normalizedEmail)
        .eq("used", false)
        .gte("expires_at", now)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!token) {
        return { error: "This code is invalid or has expired. Please request a new one." };
    }

    // Lock after too many attempts.
    if (token.attempts >= MAX_OTP_ATTEMPTS) {
        await supabase
            .from("password_reset_tokens")
            .update({ used: true })
            .eq("id", token.id);
        return { error: "Too many incorrect attempts. Please request a new code." };
    }

    // Compare.
    if (!safeEqualHex(hashOtp(otp), token.otp_hash)) {
        await supabase
            .from("password_reset_tokens")
            .update({ attempts: token.attempts + 1 })
            .eq("id", token.id);
        return { error: "Incorrect code. Please try again." };
    }

    // Success: consume the OTP and create a reset session.
    await supabase.from("password_reset_tokens").update({ used: true }).eq("id", token.id);

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(
        Date.now() + SESSION_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { error: sessionError } = await supabase.from("password_reset_sessions").insert({
        id: sessionId,
        user_id: token.user_id,
        email: normalizedEmail,
        expires_at: expiresAt,
    });

    if (sessionError) {
        console.error("Failed to create reset session:", sessionError.message);
        return { error: "Could not verify your code. Please try again." };
    }

    return { sessionId, userId: token.user_id };
}

// ---------------------------------------------------------------------------
// consumeResetSession
// ---------------------------------------------------------------------------
export interface ResetSession {
    userId: string;
    email: string;
}
export interface NoSession {
    none: true;
}
export type GetSessionResult = ResetSession | NoSession;

/** Look up a reset session by its UUID (the cookie value). */
export async function getResetSession(sessionId: string | undefined): Promise<GetSessionResult> {
    if (!sessionId) return { none: true };

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { data: session } = await supabase
        .from("password_reset_sessions")
        .select("user_id, email, used, expires_at")
        .eq("id", sessionId)
        .maybeSingle();

    if (!session || session.used || new Date(session.expires_at).toISOString() < now) {
        return { none: true };
    }

    return { userId: session.user_id, email: session.email };
}

// ---------------------------------------------------------------------------
// updatePassword
// ---------------------------------------------------------------------------
export interface UpdatePasswordSuccess {
    ok: true;
}
export interface UpdatePasswordFailure {
    error: string;
}
export type UpdatePasswordResult = UpdatePasswordSuccess | UpdatePasswordFailure;

export async function updatePassword(
    sessionId: string | undefined,
    newPassword: string
): Promise<UpdatePasswordResult> {
    const session = await getResetSession(sessionId);
    if ("none" in session) {
        return { error: "Your reset session has expired. Please start again." };
    }

    const supabase = createAdminClient();

    // Update the user's password via the admin API.
    const { error: updateError } = await supabase.auth.admin.updateUserById(session.userId, {
        password: newPassword,
    });

    if (updateError) {
        console.error("updatePassword error:", updateError.message);
        return { error: updateError.message };
    }

    // Invalidate the session so it can't be reused.
    await supabase
        .from("password_reset_sessions")
        .update({ used: true })
        .eq("id", sessionId!);

    return { ok: true };
}