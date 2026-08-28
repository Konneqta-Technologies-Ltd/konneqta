"use client";

import { useState } from "react";

/**
 * Shared bio limits.
 *
 * BIO_MAX_CHARS — hard cap enforced by the onboarding/edit form textareas
 *   (maxLength). Existing longer bios are grandfathered: they still render in
 *   full here and saving them is never blocked.
 *
 * BIO_PREVIEW_CHARS — bios longer than this get the See more/See less toggle.
 *   Kept at 70 (not 100) because the collapsed preview appends "…See more"
 *   inline (~12 chars of visual width); 85 + the link ≈ the 100 chars that
 *   previously fit on 2 lines, so the collapsed state can never spill onto a
 *   third line.
 */
export const BIO_MAX_CHARS = 1500;
export const BIO_PREVIEW_CHARS = 64;

/**
 * CardBio — theme-aware bio block for the card front layouts.
 *
 * Behavior by bio length:
 * - ≤ 60 chars: natural flow, clamped at 2 lines (line-clamp-2 — one line
 *   stays one line, two stay two). No "See more", no fixed box.
 * - > 60 chars:
 *   - Collapsed: the text is truncated at 60 chars + an inline "See more"
 *     link (text-xs, theme-accent, underlined) directly after the ellipsis —
 *     reads as "...See more". The whole thing sits in the same 2-line
 *     clamped paragraph, so it can never exceed 2 lines. No toggle is shown
 *     when there is no hidden text left.
 *   - Expanded: the full bio lives in a box pinned to EXACTLY 2 lines
 *     (leading-normal = 1.5 → h-[4em] = 2 × 1.5em) that scrolls internally
 *     (overflow-y-auto, thin scrollbar via .scrollable-links). A "See less"
 *     link (text-xs) sits inline at the very end of the text inside the
 *     scroll area. The height never changes, so the avatar/content above and
 *     the flip button below are never shifted or squashed, in any layout.
 * - `interactive={false}` (AppearanceModal previews inside a <button>): the
 *   links render as non-interactive <span>s styled identically — avoids the
 *   nested-<button> hydration error, same approach as FlipButton's guard.
 */
export default function CardBio({
  bio,
  color,
  accent,
  className = "",
  interactive = true,
}: {
  bio: string;
  /** Bio body text color (usually the theme's subtext). */
  color?: string;
  /** "See more" / "See less" link color (usually the theme's accent). */
  accent?: string;
  /** Layout's own text classes (size/margins), e.g. "mt-2 max-w-xs text-center text-xs". */
  className?: string;
  /** false inside <button> previews — renders a non-interactive link. */
  interactive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const linkStyle = accent ? { color: accent } : undefined;
  const linkClass =
    "cursor-pointer whitespace-nowrap text-xs font-medium underline underline-offset-2";
  const centered = className.includes("text-center");

  // Short bio — natural flow clamped at 3 lines. No toggle, no fixed box.
  if (bio.length <= BIO_PREVIEW_CHARS) {
    return (
      <p
        className={`${className} line-clamp-2 h-4`}
        style={color ? { color } : undefined}
      >
        {bio}
      </p>
    );
  }

  // Collapsed — 60-char preview + "... See more" inline, clamped to 2 lines.
  if (!expanded) {
    const preview = `${bio.slice(0, BIO_PREVIEW_CHARS).trimEnd()}.`;
    return (
      <p
        className={`${className} line-clamp-2`}
        style={color ? { color } : undefined}
      >
        {preview}
        {interactive ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={linkClass}
            style={linkStyle}
          >
            See more
          </button>
        ) : (
          <span
            className={`${linkClass} pointer-events-none`}
            style={linkStyle}
            aria-hidden="true"
          >
            See more
          </span>
        )}
      </p>
    );
  }

  // Expanded — full bio in the fixed, scrolling internally, with
  // "See less" inline at the very end of the text.
  const boxClass = `scrollable-links h-[4em] leading-normal overflow-y-auto ${className} ${
    centered ? "mx-auto" : ""
  }`;

  return (
    <div
      className={boxClass}
      style={color ? { color } : undefined}
    >
      {bio}{" "}
      {interactive ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={linkClass}
          style={linkStyle}
        >
          See less
        </button>
      ) : (
        <span
          className={`${linkClass} pointer-events-none`}
          style={linkStyle}
          aria-hidden="true"
        >
          See less
        </span>
      )}
    </div>
  );
}