/**
 * Traffic-source parsing.
 *
 * Derives a normalized `source` string from the incoming request — either from
 * a `?src=qr` query param (set on printed QR codes) or from the `referer`
 * header. Falls back to "direct" when neither yields anything usable.
 */

// Known social/search hosts → friendly source labels.
const HOST_TO_SOURCE: Record<string, string> = {
  // Search
  "google.com": "google",
  "google.co": "google",
  "bing.com": "bing",
  "duckduckgo.com": "duckduckgo",
  "yahoo.com": "yahoo",
  // Social
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "tiktok.com": "tiktok",
  "reddit.com": "reddit",
  "pinterest.com": "pinterest",
  "threads.net": "threads",
  // Messaging apps often leak as referrer on mobile
  "whatsapp.com": "whatsapp",
  "t.me": "telegram",
  "telegram.org": "telegram",
};

/**
 * Resolve the traffic source from raw components.
 *
 * Priority:
 *   1. `srcParam` (from `?src=qr` query) → "qr" (baked into printed QR codes)
 *   2. Referer host → matched against known sources, else the bare host
 *   3. (nothing) → "direct"
 *
 * Works both in Route Handlers (which have a Request) and in Server Components
 * (which only have next/headers + searchParams).
 */
export function parseSource(opts: {
  srcParam?: string | null;
  referer?: string | null;
}): string {
  // 1. Explicit src param (printed-QR codes carry ?src=qr).
  if (opts.srcParam && opts.srcParam.trim()) {
    return opts.srcParam.trim().toLowerCase();
  }

  // 2. Referer header.
  const referer = opts.referer;
  if (referer) {
    try {
      const refHost = new URL(referer).hostname.replace(/^www\./, "").toLowerCase();
      // Exact match (e.g. "instagram.com").
      if (HOST_TO_SOURCE[refHost]) return HOST_TO_SOURCE[refHost];
      // Prefix match for country-domain variants (e.g. "google.co.uk").
      const base = refHost.split(".").slice(-2).join(".");
      if (HOST_TO_SOURCE[base]) return HOST_TO_SOURCE[base];
      // Unknown but present — use the host itself (still useful for "top sources").
      return refHost;
    } catch {
      // Malformed referer — ignore.
    }
  }

  // 3. No referer and no src param.
  return "direct";
}
