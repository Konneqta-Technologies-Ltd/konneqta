/**
 * One-off dev script: generate the PNG icons required for an installable
 * PWA + iOS apple-touch icon + a maskable (safe-zone padded) Android icon,
 * plus the browser favicons.
 *
 * Output:
 *   public/icons/{icon-192.png,icon-512.png,icon-maskable-512.png,apple-touch-180.png}
 *   public/{favicon-16x16.png,favicon-32x32.png,favicon-48x48.png}
 *
 * Run with:  node scripts/generate-pwa-icons.mjs
 *
 * Design contract (agreed with the brand owner, 2026-07-01; updated
 * 2026-07-20 to a new master PNG logo):
 *  - Splash / install UI background = pure black (#000000).
 *  - Logo = the supplied 1024x1024 `konneqta-logo.png` master.
 *  - Regular (non-maskable) icons: solid black background, logo fitted to ~80%.
 *  - Maskable icon: solid black background + safe-zone padding (logo at ~64%
 *    of canvas) so Android adaptive icon shapes don't crop the logo.
 *  - The web app banner / OG image (`public/banner.png`) is NOT touched by
 *    this script — it stays as the existing splash asset.
 */

import { dirname, resolve } from "node:path";

import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
// NEW master logo (1024x1024 PNG). Replaces the old SVG wordmark source.
const masterPath = resolve(root, "public", "konneqta-logo.png");
const outDir = resolve(root, "public", "icons");
const publicDir = resolve(root, "public");

mkdirSync(outDir, { recursive: true });

// Rasterize once at high resolution, then composite/resize for each target.
const MASTER_PX = 1024;

/**
 * Build a square PNG of `size`px with the logo scaled to `logoRatio` of the
 * canvas and centered on a `bg` background.
 */
async function makeIcon(size, logoRatio, bg, outFile) {
  const logoSize = Math.round(size * logoRatio);
  const offset = Math.round((size - logoSize) / 2);

  const logo = await sharp(masterPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const layers = [];

  if (bg) {
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${bg}"/></svg>`
      ),
      top: 0,
      left: 0,
    });
  }

  layers.push({ input: logo, top: offset, left: offset });

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg ? { r: 0, g: 0, b: 0, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toFile(resolve(outDir, outFile));

  console.log(`✓ ${outFile} (${size}x${size}, logo ${Math.round(logoRatio * 100)}%)`);
}

// Regular icons: solid black background, logo at ~80%.
// NOTE: Previously these used transparent backgrounds, but some Android and
// iOS launch screens render the transparent areas as WHITE instead of
// respecting the manifest's background_color, producing a white splash.
// A solid black background here guarantees the splash is always black.
await makeIcon(MASTER_PX, 0.8, "#000000", "icon-master.png");
await makeIcon(192, 0.8, "#000000", "icon-192.png");
await makeIcon(512, 0.8, "#000000", "icon-512.png");

// Apple touch icon MUST be opaque (iOS adds rounded corners itself).
// Use a solid black background so it matches the splash theme.
await makeIcon(180, 0.8, "#000000", "apple-touch-180.png");

// Maskable icon: solid black background + safe-zone padding (logo ~64%).
await makeIcon(512, 0.64, "#000000", "icon-maskable-512.png");

// ── Browser favicons (referenced in app/layout.tsx icons block) ─────────
// Generated directly from the same master logo at the standard favicon
// sizes. Transparent background so they sit cleanly on any browser chrome.
async function makeFavicon(size, outFile) {
  const logoSize = Math.round(size * 0.92); // nearly full-bleed for tiny sizes
  await sharp(masterPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round((size - logoSize) / 2),
      bottom: Math.round((size - logoSize) / 2),
      left: Math.round((size - logoSize) / 2),
      right: Math.round((size - logoSize) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(resolve(publicDir, outFile));
  console.log(`✓ ${outFile} (${size}x${size})`);
}

await makeFavicon(16, "favicon-16x16.png");
await makeFavicon(32, "favicon-32x32.png");
await makeFavicon(48, "favicon-48x48.png");

console.log("\nAll PWA icons generated into public/icons/");
console.log("Favicons generated into public/");
