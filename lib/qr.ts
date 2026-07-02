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

export type GenerateQrOptions = {
  /** Absolute profile URL, e.g. https://www.konneqta.com/johndoe */
  profileUrl: string;
  /** Optional image URL to embed in the QR center (e.g. user's logo_url). */
  logoUrl?: string | null;
  /** Pixel size of the generated PNG square. Default 480. */
  size?: number;
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
}: GenerateQrOptions): Promise<string> {
  // 1. Generate the base QR as a data URL.
  const qrDataUrl = await QRCode.toDataURL(profileUrl, {
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
    // plain QR rather than failing the whole profile flow.
    console.warn("QR logo compositing failed, using plain QR:", err);
    return qrDataUrl;
  }
}

/**
 * Draw the QR onto a canvas, then overlay the logo centered and padded.
 * Returns the canvas as a PNG data URL.
 */
function compositeLogo(
  qrDataUrl: string,
  logoUrl: string,
  size: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get 2D canvas context"));
      return;
    }

    const qrImg = new Image();
    qrImg.onload = () => {
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

      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous"; // avoid tainted canvas on remote logos
      logoImg.onload = () => {
        ctx.drawImage(logoImg, x + pad, y + pad, logoBox, logoBox);
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      logoImg.onerror = () => reject(new Error("Logo image failed to load"));
      logoImg.src = logoUrl;
    };
    qrImg.onerror = () => reject(new Error("QR image failed to load"));
    qrImg.src = qrDataUrl;
  });
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