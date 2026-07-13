import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Production origin, with a safe fallback. Never localhost — the previous
  // default leaked a dev URL into robots.txt on production builds.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.konneqta.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",

        // Prevent indexing of internal / no-SEO-value pages.
        disallow: [
          // JSON / server-only endpoints.
          "/api/",
          // Auth flows: login, signup, OAuth callbacks, password reset.
          "/auth/",
          // Authenticated onboarding wizard.
          "/onboarding/",
          // Post-login redirect helper.
          "/post-login/",
          // Payment callback / Flutterwave redirect handling.
          "/payment/",
          // PWA offline fallback shell (no standalone content).
          "/offline/",
          // Service worker assets served by Serwist.
          "/serwist/",
          // Sentry debug / example route (non-production).
          "/sentry-example-page/",
          // Profile editor — authenticated, per-user.
          "/*/edit",
          // vCard (.vcf) download endpoint — binary, no HTML to index.
          "/*/vcard",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,

    host: baseUrl,
  };
}