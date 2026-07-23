import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic Open Graph image generator (Next.js 16 file convention).
 *
 * Produces a PORTRAIT, AVATAR-ONLY social-preview card for every profile.
 * The image contains ONLY the user's avatar (cover-fitted to fill the frame)
 * on a solid black background — no name, no job title, no bio, no wordmark.
 * That textual data travels in the page metadata (title) instead, keeping
 * the visual card clean and uncluttered.
 *
 * Dimensions: 1200×1500 (4:5 portrait). This renders well on WhatsApp,
 * iMessage, LinkedIn, and Twitter/X. Next.js auto-wires the correct
 * og:image:width / og:image:height meta tags from the `size` export below,
 * so strict crawlers won't reject the card for dimension mismatches.
 *
 * The route is force-dynamic because the avatar is per-user and changes
 * when a user updates their photo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Image metadata — consumed by Next.js to generate the og:image meta tags.
export const alt = "Konneqta Profile";
export const size = { width: 1200, height: 1500 };
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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        {avatarUrl ? (
          // Avatar cover-fitted so it fills the entire portrait frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
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
              fontSize: 480,
              color: "#7751b8",
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