/**
 * Client-side image compression — shrinks avatar/logo uploads in the browser
 * BEFORE they're sent to Supabase, so we never store (or serve) a 5MB photo.
 *
 * WHY THIS EXISTS
 * --------------
 * Without this, a user uploads a 5MB phone photo → it's stored at full size →
 * served to every visitor at full size → slow loads, blown data budgets, and
 * failed Lighthouse audits. We can't control what users pick, so we process
 * the file in the browser instead.
 *
 * The result is visually lossless for a small circular/square avatar
 * (512×512 @ 0.92 quality) while being ~30–80KB instead of megabytes.
 *
 * HOW IT WORKS
 * ------------
 * 1. Read the File into an <img> (via createObjectURL).
 * 2. Draw it onto a <canvas>, resized so the longest edge ≤ maxSize.
 * 3. Export the canvas to a JPEG Blob at the requested quality.
 * 4. Wrap the Blob in a File with a `.jpg` name (Supabase needs a name + type).
 *
 * CANVAS IS SAFE HERE
 * -------------------
 * This runs client-side only. The function never touches the server or DB —
 * it just produces a smaller File the caller then uploads as before.
 */

/**
 * Compression options for avatars.
 * 512px square @ 0.92 quality = crisp on retina displays, ~40–80KB on disk.
 */
export const AVATAR_OPTIONS = {
  maxSize: 512,
  quality: 0.95,
  outputType: "image/jpeg",
  outputExtension: "jpg",
} as const;

/**
 * Compression options for logos.
 * Logos often have transparency, so we keep PNG (lossless) but still cap the
 * dimensions so a giant source image doesn't bloat the payload.
 */
export const LOGO_OPTIONS = {
  maxSize: 256,
  quality: 0.92,
  outputType: "image/png",
  outputExtension: "png",
} as const;

/**
 * Compression options for showcase item images.
 * Product images render much larger than an avatar thumbnail (owner grid +
 * visitor modal), so the cap is 1024px — still small payloads (~100–300KB)
 * while staying crisp at display size. Same pipeline as avatars: re-encoding
 * through the canvas also strips EXIF metadata (incl. GPS location) from
 * phone photos before they're stored.
 */
export const SHOWCASE_OPTIONS = {
  maxSize: 1024,
  quality: 0.92,
  outputType: "image/jpeg",
  outputExtension: "jpg",
} as const;

export type CompressOptions = {
  /** Maximum width/height of the output, in pixels. Default 512. */
  maxSize?: number;
  /** JPEG/WebP quality, 0–1. Ignored for PNG. Default 0.92. */
  quality?: number;
  /** Output MIME type. Default "image/jpeg". */
  outputType?: "image/jpeg" | "image/webp" | "image/png";
  /** File extension used in the returned File's name. */
  outputExtension?: string;
};

/**
 * Load a File into an HTMLImageElement. Resolves once the image has decoded
 * so we can read its natural dimensions.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image file."));
    };
    img.src = url;
  });
}

/**
 * Compress + resize an image File in the browser.
 *
 * Returns a NEW File (always JPEG/PNG/WebP depending on options) that is:
 *   - resized so the longest edge ≤ maxSize (aspect ratio preserved), and
 *   - re-encoded at the requested quality.
 *
 * If compression somehow fails (rare — corrupt file, canvas blocked), the
 * ORIGINAL file is returned untouched so the upload never breaks.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxSize = 512,
    quality = 0.92,
    outputType = "image/jpeg",
    outputExtension = "jpg",
  } = options;

  try {
    const img = await loadImage(file);

    // Compute the scaled dimensions, preserving aspect ratio.
    const { width: srcW, height: srcH } = img;
    let dstW = srcW;
    let dstH = srcH;
    const longest = Math.max(srcW, srcH);
    if (longest > maxSize) {
      const scale = maxSize / longest;
      dstW = Math.round(srcW * scale);
      dstH = Math.round(srcH * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // No 2D context (extremely rare) — fall back to the original.
      return file;
    }

    // High-quality scaling.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, dstW, dstH);

    // PNG ignores the quality argument, so it's safe to always pass it.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, quality)
    );

    if (!blob) {
      return file;
    }

    // Preserve the original base name but swap the extension so the upload
    // path and Content-Type line up with the actual encoded format.
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${outputExtension}`, {
      type: outputType,
    });
  } catch {
    // Never let compression break the upload — return the original.
    return file;
  }
}