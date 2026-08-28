/**
 * Showcase — shared types, field limits and sanitisation for the per-card
 * product/service catalogue.
 *
 * OWNER side: app/[username]/showcase (full CRUD, plan-limited:
 * free = 2 items, pro = 10, exempt = unlimited — see lib/entitlements.ts).
 * VISITOR side: a trigger under the copy-link row on the public card opens a
 * view-only modal (components/showcase/ShowcaseViewerModal.tsx).
 *
 * SECURITY
 * -------
 * These are the READ-side helpers. The real gates are:
 *   - RLS + CHECK constraints (supabase/showcase-setup.sql)
 *   - owner-scoped storage policies on the `showcase` bucket
 * Client-side limits/sanitisation are convenience + defence-in-depth.
 */

/** Max item name length (the only required field). Mirrors the DB CHECK. */
export const SHOWCASE_NAME_MAX_CHARS = 80;

/** Max description length. Mirrors the DB CHECK constraint. */
export const SHOWCASE_DESCRIPTION_MAX_CHARS = 300;

/**
 * Max price length. Price is intentionally FREE TEXT — currency-agnostic, so
 * "₦25,000", "$30/month" and "Free" all work. Mirrors the DB CHECK.
 */
export const SHOWCASE_PRICE_MAX_CHARS = 30;

/** Max ORIGINAL image size (checked pre-compression): 2 MB. */
export const SHOWCASE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type ShowcaseItem = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  image_url: string | null;
  position: number;
  created_at?: string;
};

/*
 * Control-character stripping patterns. Built with String.fromCharCode
 * instead of regex literals so eslint's no-control-regex rule stays quiet.
 * The "keep newlines" variant preserves \n for multi-line descriptions.
 */
const CC = String.fromCharCode;
const CONTROLS_KEEP_NEWLINES = new RegExp(
  `[${CC(0)}-${CC(9)}${CC(11)}-${CC(31)}${CC(127)}]`,
  "g",
);
const CONTROLS_ALL = new RegExp(`[${CC(0)}-${CC(31)}${CC(127)}]`, "g");

/**
 * Sanitise user-typed showcase text: strip control characters (keeping
 * newlines for multi-line descriptions), collapse 3+ space/tab runs, trim.
 *
 * React escapes rendered output automatically, so this is hygiene, not the
 * XSS gate — the DB CHECK constraints are the real backstop.
 */
export function sanitizeShowcaseText(
  value: string,
  opts?: { multiline?: boolean },
): string {
  const pattern = opts?.multiline ? CONTROLS_KEEP_NEWLINES : CONTROLS_ALL;
  return value.replace(pattern, "").replace(/[ \t]{3,}/g, "  ").trim();
}

/** Uppercase initial for the placeholder tile when an item has no image. */
export function showcaseInitial(name: string): string {
  const initial = name.trim().charAt(0).toUpperCase();
  return initial || "?";
}

/**
 * Extract the storage object path from a showcase public URL — used for
 * orphan cleanup when an item's image is replaced, removed or deleted.
 * e.g. "https://xyz.supabase.co/storage/v1/object/public/showcase/uid/x.jpg?t=1"
 *   → "uid/x.jpg". Returns null for anything that isn't a showcase URL.
 */
export function extractShowcaseStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/object/public/showcase/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return parsed.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}