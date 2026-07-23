/**
 * Shared constants for the custom OTP password-reset flow.
 * Kept in a plain module so both route handlers and the server-gated page can
 * import the same values without crossing route-boundary imports.
 */
export const RESET_COOKIE_NAME = "kq_reset_session";
export const SESSION_TTL_MINUTES = 10;