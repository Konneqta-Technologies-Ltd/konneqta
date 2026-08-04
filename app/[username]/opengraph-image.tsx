import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic Open Graph image generator (Next.js file convention).
 *
 * Generates a universal Open Graph image for every public Konneqta profile.
 *
 * DESIGN GOALS
 * - Uses the standard 1200×630 Open Graph aspect ratio for broad compatibility.
 * - Preserves the entire profile image using `objectFit: contain`.
 * - Uses Konneqta's brand color as the background instead of cropping images.
 * - Keeps the image lightweight and cacheable for social crawlers.
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
  // Also fetch owner_id so we can check the owner's status — a deactivated
  // account must NOT expose an OG image (behaves as if it doesn't exist).
  const { data: card } = await supabase
    .from("cards")
    .select("owner_id, full_name, avatar_url")
    .eq("slug", username)
    .maybeSingle();

  // If the owner has deactivated their account, render a generic "Konneqta"
  // fallback so scrapers don't expose the user's identity.
  let isDeactivated = false;
  if (card?.owner_id) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", card.owner_id)
      .maybeSingle();
    isDeactivated = owner?.status === "deactivated";
  }

  const fullName = isDeactivated ? "Konneqta" : card?.full_name?.trim() || username;
  const avatarUrl = isDeactivated ? "" : card?.avatar_url?.trim() || "";

  // Brand colors.
  const BG = "#7751b8";
  const ACCENT = "#ffffff";
  const AVATAR_SIZE = 500  ;

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
          overflow: "hidden",
          
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            style={{
              width: "96%",
              height: "96%",
              objectFit: "cover",
              objectPosition: "top",
              
            }}
            alt=""
          />
        ) : (
          // Fallback when no avatar: large initial letter on the brand bg.
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