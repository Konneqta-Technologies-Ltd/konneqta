import type { NextConfig } from "next";
import fs from "fs";
import { withSentryConfig } from "@sentry/nextjs";
import { withSerwist } from "@serwist/turbopack";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).hostname : "";
  } catch {
    return "";
  }
})();

// Expose the app version (from package.json) to both server and client. Used
// by the feedback system to tag each report with the version it was submitted
// from. Read here (build-time) so it's inlined as a static string.
const APP_VERSION = JSON.parse(
  fs.readFileSync("./package.json", "utf8")
).version as string;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  turbopack: {
    // Use the real filesystem path so the casing (e.g. "Desktop" vs "desktop")
    // and separators match what Turbopack's Rust core expects on Windows.
    root: fs.realpathSync(process.cwd()),
  },
  images: {
    // Next.js 16 requires an explicit qualities allowlist
    qualities: [75, 90, 100],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
          },
        ]
      : [],
  },
  // Redirects:
  // 1. Host-based redirect for the old Vercel domain.
  // 2. /home → / : the landing page now lives at the domain root ("/"). A
  //    permanent (308) redirect consolidates all links, bookmarks, and search
  //    equity that pointed at the old /home URL onto the canonical root.
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "konneqta.vercel.app",
          },
        ],
        destination: "https://www.konneqta.com/:path*",
        permanent: true,
      },
    ];
  },
};

// @serwist/turbopack wraps the Next config to enable Turbopack-native service
// worker compilation. The SW source lives at app/sw.ts and is served by the
// route handler at app/serwist/route.ts (output: /serwist.js).
// This works with Next.js 16's default Turbopack for both dev and build.
export default withSentryConfig(withSerwist(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "konneqta",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});