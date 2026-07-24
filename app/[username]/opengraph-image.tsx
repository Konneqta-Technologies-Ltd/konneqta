import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic Open Graph image generator (Next.js file convention).
 *
 * Produces a PORTRAIT, AVATAR-ONLY social-preview card for every profile.
 *
 * DESIGN GOALS:
 *  1. WhatsApp-compatible file size — the solid-color background compresses
 *     to almost nothing in PNG, so a photo avatar only contributes a small
 *     region. This keeps the image well under WhatsApp's ~1MB effective cap
 *     (previously a full-bleed photo pushed it to 2-3MB and WhatsApp dropped
 *     the preview entirely).
 *  2. No cropping — the avatar uses `objectFit: contain` inside a centered
 *     circular frame so faces are never cut off regardless of source aspect
 *     ratio.
 *
 * Dimensions: 1200×1500 (4:5 portrait). Renders well on WhatsApp, iMessage,
 * LinkedIn, and Twitter/X. Next.js auto-wires og:image:width / height.
 */

export const runtime = "nodejs";
// Cache the generated image for 1 hour. Avatars change rarely, and repeat
// fetches from crawlers (WhatsApp re-scrapes on every share) become instant.
export const revalidate = 3600;

// Image metadata — consumed by Next.js to generate the og:image meta tags.
export const alt = "Konneqta Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Lightweight anon client — no cookies needed for public card data.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Fetch only the fields needed to render the avatar (or fallback initial).
  const { data: card } = await supabase
    .from("cards")
    .select("full_name, avatar_url")
    .eq("slug", username)
    .maybeSingle();

  const fullName = card?.full_name?.trim() || username;
  const avatarUrl = card?.avatar_url?.trim() || "";

  // Brand colors.
  const BG = "#0a0a0a";
  const ACCENT = "#7751b8";
  const AVATAR_SIZE = 500;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          position: "relative",
        }}
      >
        {/* Subtle brand accent bar at the top — tiny in file size, big in
            visual identity. Helps the card read as "Konneqta". */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            
            display: "flex",
          }}
        />

        {avatarUrl ? (
          // Avatar shown CONTAINED inside a circular frame so nothing is
          // cropped. The surrounding black canvas is pure solid color →
          // compresses to near-zero bytes, keeping the PNG small enough for
          // WhatsApp to display.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              objectFit: "contain",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              
            }}
            alt=""
          />
        ) : (
          // Fallback when no avatar: large initial letter on black.
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: "50%",
              
              fontSize: 240,
              color: ACCENT,
              fontWeight: "bold",
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    ),
    {
      ...size,
    },
  );
}