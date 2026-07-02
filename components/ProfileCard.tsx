"use client";

import Image from "next/image";
import { PLATFORM_MAP } from "@/lib/social-platforms";
import ShareMenu from "./ShareMenu";
import Tooltip from "./Tooltip";
import {
  safeHref,
} from "@/lib/url-validation";
import { useState } from "react";

type SocialLink = {
  platform: string;
  url: string;
};

type Profile = {
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  qr_code_url: string | null;
};

/** Circular icon button shared by the card's action row. */
function IconButton({
  href,
  onClick,
  label,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

  const content = href ? (
    <a href={href} aria-label={label} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {children}
    </button>
  );

  return (
    <Tooltip label={label} side="bottom">
      {content}
    </Tooltip>
  );
}

export default function ProfileCard({
  profile,
  socialLinks,
  isOwner = false,
}: {
  profile: Profile;
  socialLinks: SocialLink[];
  isOwner?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayName = profile.full_name || profile.username;
  


  // Compute the absolute profile URL lazily at click-time (client-only).
  const getProfileUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/${profile.username}`
      : `/${profile.username}`;

  const handleCopy = async () => {
    const profileUrl = getProfileUrl();
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
      {/* ---- Flip card ---- */}
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
            className="flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <div className=" overflow-hidden avatar relative">

            {profile.avatar_url && (
              <Image
              src={profile.avatar_url}
              alt={profile.username}
              width={290}
              height={290}
              priority
              className=" h-56 max-w-65 object-cover"
              unoptimized
              />
              )}
              <div className="absolute top-0 right-0  w-20 h-full bg-[#7751b8]/70 ">

            </div>
            </div>

            <div className="bg-[#201F1F] w-65 rounded-b-3xl px-5 py-6">

           
           
              <h1 className="text-lg text-left font-medium  text-zinc-900 dark:text-zinc-50">
                {displayName}
              </h1>
            

              <div className="flex items-center justify-between">
  
              <div className="flex gap-2 items-center">
            
              <p className=" text-sm font-light text-zinc-700 dark:text-[#CFCFCF]">
                {profile.job_title}
              </p>
           
            <p className=" text-sm font-medium text-zinc-500 dark:text-[#CFCFCF]">{profile.company}</p>
                </div>
              {profile.logo_url && (
                <Image
                  src={profile.logo_url}
                  alt={`${displayName} logo`}
                  width={15}
                  height={15}
                  className="h-4 w-4 shrink-0  object-contain"
                  unoptimized
                />
              )}
</div>
            </div>

             {profile.bio && (
              <p className="my-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                {profile.bio}
              </p>
            )}

            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="mt-8 flex cursor-pointer w-10 h-10 items-center gap-2 rounded-full bg-(--main-orange) px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
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

          {/* ---------- BACK ---------- */}
          <div
            className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
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
                <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No links added yet.
                </p>
              ) : (
                socialLinks.map((link, index) => {
                  const platform = PLATFORM_MAP[link.platform];
                  const Icon = platform?.icon;
                  const label = platform?.label ?? link.platform;
                  // DEFENSE-IN-DEPTH: sanitize the href at render time.
                  // If a dangerous URL (javascript:, data:, etc.) somehow
                  // made it into the DB, safeHref returns null and we skip
                  // rendering the link entirely rather than render a live
                  // XSS vector.
                  const href = safeHref(
                    link.url,
                    link.platform === "email"
                  );
                  if (!href) return null;
                  return (
                    <a
                      key={index}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                    >
                      {Icon ? (
                        <Icon className="h-5 w-5" />
                      ) : (
                        <span className="text-xs font-medium uppercase">
                          {label.charAt(0)}
                        </span>
                      )}
                    </a>
                  );
                })
              )}
            </div>

            {/* ---- QR Code (back of card) ---- */}
            {profile.qr_code_url ? (
              <div className=" flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.qr_code_url}
                  alt={`Scan to view ${displayName}'s profile`}
                  className="h-44 w-44 rounded-lg border border-zinc-200 bg-white object-contain dark:border-zinc-700"
                />
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Scan to connect
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="mt-4 flex mx-auto cursor-pointer w-10 h-10 items-center gap-2 rounded-full bg-(--main-orange) px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
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

      {/* ---- Bottom action area (icons + copy link, centered) ---- */}
      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {isOwner && (
            <IconButton href={`/${profile.username}/edit`} label="Edit Profile">
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
              </svg>
            </IconButton>
          )}

          {/* Save Contact — always available (name + URL), for owner & visitor. */}
          <IconButton
            href={`/${profile.username}/vcard`}
            label="Save Contact"
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
              <path d="M16 2v4a2 2 0 0 0 2 2h4" />
              <path d="M3.27 6.96 12 12.01l8.73-5.05" />
              <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5Z" />
              <path d="M8 14h.01M12 14h.01M16 14h.01" />
            </svg>
          </IconButton>

          <Tooltip label="Share" side="top">
            <ShareMenu username={profile.username} title={displayName} />
          </Tooltip>
        </div>

        <Tooltip label={copied ? "Copied!" : "Copy link"} side="top">
          <button
            type="button"
            onClick={handleCopy}
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
          >
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-green-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
            www.konneqta.com/@{profile.username}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}