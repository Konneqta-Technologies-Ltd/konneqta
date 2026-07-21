import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

/**
 * Dynamic Open Graph image generator (Next.js 16 file convention).
 *
 * Produces a personalized 1200×630 social-preview card for every profile.
 * Next.js auto-wires the generated image into:
 *   <meta property="og:image" content="..."/>
 *   <meta property="og:image:width" content="1200"/>
 *   <meta property="og:image:height" content="630"/>
 *   <meta property="og:image:type" content="image/png"/>
 *
 * Why this exists: the previous approach used the raw avatar URL as
 * og:image, but avatars are portrait/square and were declared as
 * 1200×630 — strict crawlers (WhatsApp, Telegram, LinkedIn) reject
 * the entire preview card when declared dimensions don't match.
 * This route guarantees a correctly-sized, branded card every time.
 *
 * The route is force-dynamic because the card data is per-user and
 * changes when a user edits their profile.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Image metadata (consumed by Next.js to generate the og:image meta tags).
export const alt = "Konneqta Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Lightweight anon client — no cookies needed for public card data.
// Using the env vars directly avoids the cookies() call in server.ts
// which has no meaning for a crawler fetching an image.
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

  // Fetch only the public fields needed for the card.
  const { data: card } = await supabase
    .from("cards")
    .select("full_name, job_title, company, bio, avatar_url")
    .eq("slug", username)
    .maybeSingle();

  const fullName = card?.full_name?.trim() || username;
  const jobTitle = card?.job_title?.trim() || "";
  const company = card?.company?.trim() || "";
  const bio = card?.bio?.trim() || "";
  const avatarUrl = card?.avatar_url?.trim() || "";

  // Build subtitle: "JobTitle at Company" or just one or the other.
  const subtitleParts = [jobTitle, company && `at ${company}`].filter(Boolean);
  const subtitle = subtitleParts.join(" ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* ── Top section: avatar + name + subtitle ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
          {/* Avatar — circle crop via border-radius. Satori fetches the
              remote image automatically when given a URL in <img src>. */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              width={200}
              height={200}
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "4px solid #7751b8",
              }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "#7751b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                color: "white",
                fontWeight: "bold",
              }}
            >
              {fullName.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Name */}
            <div
              style={{
                fontSize: 64,
                fontWeight: "bold",
                color: "white",
                lineHeight: 1.1,
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              {fullName}
            </div>
            {/* Subtitle: JobTitle at Company */}
            {subtitle ? (
              <div
                style={{
                  fontSize: 32,
                  color: "#a78bfa",
                  display: "flex",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Bottom section: bio + brand ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#a1a1aa",
              maxWidth: 700,
              display: "flex",
            }}
          >
            {bio ? bio : `Connect with ${fullName} on Konneqta`}
          </div>
          {/* Brand wordmark */}
          <div
            style={{
              fontSize: 36,
              fontWeight: "bold",
              color: "#7751b8",
              display: "flex",
            }}
          >
            Konneqta
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}