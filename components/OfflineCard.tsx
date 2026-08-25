"use client";

/**
 * Offline card — renders the owner's saved snapshot with ZERO network.
 *
 * - Reuses the exact same theme layouts as the live card (renderCardFront),
 *   so it looks identical to what the owner saw online.
 * - The QR is REGENERATED on-device (the `qrcode` package is pure JS and
 *   works fully offline), so it is always crisp and scannable — it encodes
 *   the same production URL (`/{username}?src=qr`) as the stored PNG.
 * - Social links on the back open external apps (WhatsApp, mail, etc.),
 *   which work independently of Konneqta's network.
 * - Images (avatar/banner) come from the SW's image cache — they were stored
 *   when the owner last viewed their card online.
 */

import { generateQrDataUrl, getCanonicalProfileUrl } from "@/lib/qr";
import { resolveTheme } from "@/lib/themes";
import { PLATFORM_MAP } from "@/lib/social-platforms";
import { renderCardFront } from "@/components/card-layouts";
import { safeHref } from "@/lib/url-validation";
import { useEffect, useState } from "react";
import type { OfflineCardSnapshot } from "@/lib/offline/card-snapshot";

export default function OfflineCard({
  snapshot,
}: {
  snapshot: OfflineCardSnapshot;
}) {
  const { profile, socialLinks } = snapshot;
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Regenerate the QR on-device. If the logo can't load offline,
  // generateQrDataUrl falls back to a plain QR (built into lib/qr.ts).
  useEffect(() => {
    let active = true;
    generateQrDataUrl({
      profileUrl: getCanonicalProfileUrl(profile.username),
      logoUrl: profile.logo_url,
      size: 480,
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        // Keep null — the QR box shows its placeholder.
      });
    return () => {
      active = false;
    };
  }, [profile.username, profile.logo_url]);

  const theme = resolveTheme(profile.theme, profile.theme_custom);
  const c = theme.colors;
  const displayName = profile.full_name || profile.username;

  const handleCopy = async () => {
    const profileUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/${profile.username}`
        : `/${profile.username}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = profileUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-sm">
      {/* ---- Offline chip ---- */}
      <div className="mb-4 flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-(--main-orange)" />
        Offline — showing your saved card
      </div>

      {/* ---- Flip card (same structure as ProfileCard) ---- */}
      <div style={{ height: 500, perspective: "1200px" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* ---------- FRONT ---------- */}
          <div
            className="flex flex-col items-center justify-center overflow-hidden rounded-3xl border p-8 text-center shadow-sm"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              background: c.bg,
              transform: "rotateY(0deg)",
              pointerEvents: flipped ? "none" : "auto",
              zIndex: flipped ? 0 : 1,
            }}
          >
            {renderCardFront({
              profile: {
                username: profile.username,
                full_name: profile.full_name,
                job_title: profile.job_title,
                company: profile.company,
                phone: profile.phone,
                bio: profile.bio,
                avatar_url: profile.avatar_url,
                logo_url: profile.logo_url,
              },
              theme,
              bannerUrl: profile.banner_url,
              onFlip: () => setFlipped(true),
            })}
          </div>

          {/* ---------- BACK ---------- */}
          <div
            className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="scrollable-links flex min-h-0 flex-1 flex-wrap content-start justify-center gap-3 overflow-y-auto pr-1">
              {socialLinks.length === 0 ? (
                <p className="text-center text-sm text-zinc-400">
                  No links added yet.
                </p>
              ) : (
                socialLinks.map((link, index) => {
                  const platform = PLATFORM_MAP[link.platform];
                  const Icon = platform?.icon;
                  const label = platform?.label ?? link.platform;
                  const shortLabel =
                    (link.platform === "other" && link.label?.trim()) ||
                    platform?.shortLabel ||
                    label;
                  const isEmail = link.platform === "email";
                  const href = safeHref(link.url, isEmail);
                  if (!href) return null;
                  return (
                    <a
                      key={index}
                      href={href}
                      {...(isEmail
                        ? {}
                        : { target: "_blank", rel: "noopener noreferrer" })}
                      aria-label={label}
                      className="group flex w-14 flex-col items-center gap-1"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-50 transition-colors group-hover:border-zinc-600 group-hover:bg-zinc-800">
                        {Icon ? (
                          <Icon className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-medium uppercase">
                            {label.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="max-w-14 truncate text-[10px] text-zinc-400">
                        {shortLabel}
                      </span>
                    </a>
                  );
                })
              )}
            </div>

            {/* ---- QR Code (regenerated on-device) ---- */}
            <div className="mx-auto flex h-44 w-44 flex-col items-center">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt={`Scan to view ${displayName}'s profile`}
                  className="h-40 w-40 rounded-lg border border-zinc-800 bg-white object-contain"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-500">
                  Generating QR…
                </div>
              )}
              <p className="mt-1 text-[10px] text-zinc-400">Scan to connect</p>
            </div>

            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="mx-auto mt-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: c.accent }}
              aria-label="Flip card back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Actions (copy link + retry) ---- */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="visible-focus flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          {copied ? "Copied!" : "Copy link"}
        </button>

        {/* Real (full-page) navigation, not <Link>: forces an actual network
            request to /post-login. Online → routes to the live card; offline
            → the SW serves this offline page (and the card) again. */}
        <button
          type="button"
          onClick={() => window.location.assign("/post-login")}
          className="visible-focus cursor-pointer rounded-full bg-(--main-orange) px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}