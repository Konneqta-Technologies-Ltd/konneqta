import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.konneqta.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",

        // Prevent indexing of internal pages
        disallow: [
          "/api/",
          "/auth/",
          "/onboarding/",
          "/post-login/",
          "/login/",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,

    host: baseUrl,
  };
}