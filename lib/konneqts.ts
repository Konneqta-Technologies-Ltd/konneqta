/**
 * Konneqts — shared constants and types.
 *
 * Centralises the source-channel enum so it's not hardcoded across the API,
 * UI, and SQL. Adding a new acquisition channel is a one-line change here +
 * the DB check constraint.
 */

/**
 * How a Konneqt was initiated. Mirrors the check constraint on the
 * `konneqts` and `guest_konneqts` tables (see supabase/konneqts-setup.sql).
 *
 * - QR_SCAN       — the built-in scanner or an external QR app
 * - PROFILE_PAGE  — the Connect button on /[username]
 * - PROFILE_LINK  — a direct link to the profile shared via the Share menu
 * - DIRECT_LINK   — the profile URL pasted/clicked from an external site
 * - GUEST_FORM    — the anonymous "Share my details" dialog
 * - NFC           — an NFC tap (future)
 * - MANUAL        — an admin/manual import (future)
 */
export const KONNEQT_SOURCES = {
  QR_SCAN: "QR_SCAN",
  PROFILE_PAGE: "PROFILE_PAGE",
  PROFILE_LINK: "PROFILE_LINK",
  DIRECT_LINK: "DIRECT_LINK",
  GUEST_FORM: "GUEST_FORM",
  NFC: "NFC",
  MANUAL: "MANUAL",
} as const;

export type KonneqtSource = (typeof KONNEQT_SOURCES)[keyof typeof KONNEQT_SOURCES];

/** The set of valid sources — used by the API for validation. */
export const VALID_SOURCES = new Set<string>(Object.values(KONNEQT_SOURCES));