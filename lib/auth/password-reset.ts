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
// User lookup by email
// ---------------------------------------------------------------------------
/**
 * Find an auth user by email.
 *
 * Primary path: ONE indexed query against `public.auth_user_emails`, a
 * trigger-maintained mirror of auth.users (see supabase/auth-email-lookup.sql).
 * This scales to any user-base size.
 *
 * Fallback (only while the migration hasn't been run): bounded pagination
 * over auth.admin.listUsers. A single un-paginated listUsers() call returns
 * just the first page (~50 users) and silently missed everyone beyond it —
 * the root cause of "reset email never arrives" for some accounts.
 */
async function findUserByEmail(
    supabase: ReturnType<typeof createAdminClient>,
    normalizedEmail: string
): Promise<{ id: string; email?: string } | null> {
    // --- Fast path: trigger-maintained lookup table ---
    const { data: mirrorRows, error: mirrorError } = await supabase
        .from("auth_user_emails")
        .select("user_id")
        .eq("email", normalizedEmail)
        .limit(1);

    if (!mirrorError) {
        // Table exists: no row means the user genuinely doesn't exist.
        return mirrorRows && mirrorRows.length > 0
            ? { id: mirrorRows[0].user_id, email: normalizedEmail }
            : null;
    }

    // PGRST205 = table not in schema cache → migration not run yet.
    // Any other error is logged, then we still fall through so a flaky
    // mirror never blocks password resets.
    if (mirrorError.code !== "PGRST205") {
        console.error("auth_user_emails lookup failed:", mirrorError.message);
    }

    // --- Fallback: bounded pagination over listUsers (pre-migration) ---
    const PER_PAGE = 1000; // PostgREST maximum per page
    const MAX_PAGES = 50; // safety bound (50k users) — run the SQL migration beyond this
    for (let page = 1; page <= MAX_PAGES; page++) {
        const { data: list, error: listError } = await supabase.auth.admin
            .listUsers({ page, perPage: PER_PAGE });

        if (listError) {
            console.error("listUsers failed:", listError.message);
            return null;
        }

        const hit = list.users.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (hit) return { id: hit.id, email: hit.email };

        if (list.users.length < PER_PAGE) break; // last page — stop
    }
    return null;
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
    const supabase = createAdminClient();
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
    const user = await findUserByEmail(supabase, normalizedEmail);

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

        const { error: insertError } = await supabase
            .from("password_reset_tokens")
            .insert({
                email: normalizedEmail,
                user_id: user.id,
                otp_hash: otpHash,
                ip_address: ipAddress,
                expires_at: expiresAt.toISOString(),
            });

        if (insertError) {
            console.error("Failed to store reset token:", insertError.message);
            throw insertError;
        }

        // Send the email (imported lazily so the browser bundle never sees it).
        const { sendPasswordResetOtp } = await import("@/lib/emails/zeptomail");
        const recipient = user.email ?? normalizedEmail;
        await sendPasswordResetOtp(recipient, recipient, otp);
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