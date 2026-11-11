/**
 * QR code generation helper.
 *
 * Design notes:
 * - The QR encodes exactly one thing: the profile URL `${origin}/${username}`.
 * - Generation happens client-side, in the browser, only after a successful
 *   create/update of the profile. The resulting PNG is then uploaded to the
 *   Supabase `qrcodes` bucket and its public URL stored on the profile row,
 *   so viewing the profile never re-generates (hydration-safe + CDN/SW-cacheable).
 * - If a logo URL is supplied, it is composited into the center of the QR.
 *   We bump errorCorrectionLevel to "H" so the code still scans reliably
 *   with ~20% of its center masked.
 */

import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerateQrOptions = {
  /** Absolute profile URL, e.g. https://www.konneqta.com/johndoe */
  profileUrl: string;
  /** Optional image URL to embed in the QR center (e.g. user's logo_url). */
  logoUrl?: string | null;
  /** Pixel size of the generated PNG square. Default 480. */
  size?: number;
  /**
   * Optional callback fired when a logoUrl WAS provided but could not be
   * embedded (fetch/CORS/draw failure). The plain QR is still returned —
   * the graceful fallback stays — but callers get a chance to warn the
   * user instead of the logo disappearing silently.
   */
  onLogoFailed?: (reason: string) => void;
};

/**
 * Generate a QR code PNG as a data URL.
 *
 * Without a logo this is a plain dark-on-white QR.
 * With a logo, it's drawn onto a canvas with the logo centered at ~20% of
 * the QR size, sitting on a white rounded pad.
 */
export async function generateQrDataUrl({
  profileUrl,
  logoUrl,
  size = 480,
  onLogoFailed,
}: GenerateQrOptions): Promise<string> {
  // Tag the URL with ?src=qr so that when someone scans the printed QR with
  // their phone camera, the resulting profile view is attributed to source
  // "qr" in analytics (rather than looking like direct/organic traffic).
  // The fragment is avoided; we append a query param only.
  const trackedUrl = profileUrl.includes("src=")
    ? profileUrl
    : `${profileUrl}${profileUrl.includes("?") ? "&" : "?"}src=qr`;

  // 1. Generate the base QR as a data URL.
  const qrDataUrl = await QRCode.toDataURL(trackedUrl, {
    errorCorrectionLevel: logoUrl ? "H" : "M",
    margin: 2,
    width: size,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  // No logo → return the plain QR.
  if (!logoUrl) return qrDataUrl;

  // 2. Composite the logo onto the center via canvas.
  try {
    return await compositeLogo(qrDataUrl, logoUrl, size);
  } catch (err) {
    // If logo compositing fails (e.g. CORS / load error), fall back to the
    // plain QR rather than failing the whole profile flow — but TELL the
    // caller, so the UI can warn instead of the logo silently disappearing.
    console.warn("QR logo compositing failed, using plain QR:", err);
    const reason = err instanceof Error ? err.message : String(err);
    onLogoFailed?.(reason);
    return qrDataUrl;
  }
}

/**
 * Decode an image from a URL / data URL / object URL into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Image failed to load: ${src.slice(0, 96)}`));
    img.src = src;
  });
}

/**
 * Draw the QR onto a canvas, then overlay the logo centered and padded.
 * Returns the canvas as a PNG data URL.
 *
 * The logo is FETCHED and drawn from a blob object-URL rather than loaded
 * with <img crossOrigin="anonymous">: object URLs are same-origin so the
 * canvas can never be tainted, a failed download throws with a real HTTP
 * status (an <img> onerror is opaque), and this sidesteps Safari's quirk of
 * failing a crossOrigin image request when a cached non-CORS response is
 * reused — which used to silently produce a logo-less QR.
 */
async function compositeLogo(
  qrDataUrl: string,
  logoUrl: string,
  size: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2D canvas context");
  }

  // The QR itself is a data URL — no network involved.
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, size, size);

  // Logo is ~20% of the QR, centered, on a white rounded background.
  const logoBox = Math.round(size * 0.2);
  const pad = Math.round(logoBox * 0.12);
  const totalBox = logoBox + pad * 2;
  const x = (size - totalBox) / 2;
  const y = (size - totalBox) / 2;
  const radius = Math.round(pad * 1.2);

  // White rounded background behind the logo.
  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, x, y, totalBox, totalBox, radius);
  ctx.fill();

  const res = await fetch(logoUrl, { credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Logo fetch failed with status ${res.status}`);
  }
  const objectUrl = URL.createObjectURL(await res.blob());
  try {
    const logoImg = await loadImage(objectUrl);
    ctx.drawImage(logoImg, x + pad, y + pad, logoBox, logoBox);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Convert a data URL into a File/Blob for Supabase Storage upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Resolve the canonical site origin for QR codes.
 *
 * QR codes are GENERATED ONCE (client-side) and persisted as a PNG to
 * Supabase Storage. If they used `window.location.origin`, any QR generated
 * during local dev would permanently bake `localhost:3000` into the image.
 * To avoid that, we prefer the `NEXT_PUBLIC_SITE_URL` env var (the production
 * origin) and only fall back to `window.location.origin` if it's missing
 * (e.g. a dev who hasn't configured the env yet).
 *
 * This is browser-only (the QR is generated client-side), but reading a
 * NEXT_PUBLIC_* env var is safe in both server and client contexts.
 */
export function getCanonicalOrigin(): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, ""); // strip trailing slash
  // Fallback for environments where the env var isn't set.
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * Build the canonical profile URL for a card slug, using the production
 * origin (not the current browser origin).
 */
export function getCanonicalProfileUrl(cardSlug: string): string {
  return `${getCanonicalOrigin()}/${cardSlug}`;
}

export type RegenerateQrCodeInput = {
  /** Browser Supabase client (from createClient in lib/supabase/client). */
  supabase: SupabaseClient;
  /** Auth user id — used for the storage path. */
  userId: string;
  /** Card id — the qr_code_url is stored on this cards row. */
  cardId: string;
  /** Card slug — the QR encodes `${origin}/${slug}`. */
  cardSlug: string;
  /** Optional logo URL to composite into the QR center. */
  logoUrl?: string | null;
  /**
   * Optional callback fired when a logoUrl WAS provided but could not be
   * embedded (see GenerateQrOptions.onLogoFailed) — lets callers warn the
   * user instead of the logo silently vanishing from the stored PNG.
   */
  onLogoFailed?: (reason: string) => void;
};

/**
 * Regenerate a card's QR code: generate a fresh PNG client-side, upload it to
 * the `qrcodes` bucket (upsert at `${userId}/${cardId}/qr.png`), and update
 * `cards.qr_code_url` with the new public URL.
 *
 * Returns the new public URL (cache-busted) on success, or null on failure.
 * Errors are thrown to the caller so they can show appropriate UI feedback.
 *
 * This is browser-only (uses canvas + document for logo compositing).
 */
export async function regenerateQrCode({
  supabase,
  userId,
  cardId,
  cardSlug,
  logoUrl,
  onLogoFailed,
}: RegenerateQrCodeInput): Promise<string | null> {
  // Use the canonical production origin (NEXT_PUBLIC_SITE_URL) so QRs
  // never bake in localhost. Falls back to window.location.origin only
  // when the env var is unset.
  const profileUrl = getCanonicalProfileUrl(cardSlug);

  // 1. Generate the QR PNG (with optional logo).
  const qrDataUrl = await generateQrDataUrl({
    profileUrl,
    logoUrl: logoUrl || null,
    onLogoFailed,
  });
  const qrBlob = dataUrlToBlob(qrDataUrl);
  const qrPath = `${userId}/${cardId}/qr.png`;

  // 2. Upload to Supabase Storage (upsert so we replace the old PNG).
  const { error: uploadError } = await supabase.storage
    .from("qrcodes")
    .upload(qrPath, qrBlob, { upsert: true, contentType: "image/png" });

  if (uploadError) {
    throw new Error(`QR upload failed: ${uploadError.message}`);
  }

  // 3. Get the public URL and append a cache-busting query param so the
  //    browser/CDN always fetches the fresh PNG instead of the stale cached
  //    one (same path, new content).
  const {
    data: { publicUrl },
  } = supabase.storage.from("qrcodes").getPublicUrl(qrPath);
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

  // 4. Persist the new URL on the card row.
  const { error: updateError } = await supabase
    .from("cards")
    .update({ qr_code_url: cacheBustedUrl })
    .eq("id", cardId);

  if (updateError) {
    throw new Error(`QR URL update failed: ${updateError.message}`);
  }

  return cacheBustedUrl;
}
