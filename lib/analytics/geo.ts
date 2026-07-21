/**
 * Geographic resolution from request headers.
 *
 * Uses Cloudflare's injected request headers (`cf-ipcountry`, `cf-ipcity`),
 * which require ZERO configuration when the app is proxied through Cloudflare
 * (the user hosts on Cloudflare). When the headers are absent (e.g. local dev,
 * direct hits), both values gracefully fall back to null / "Unknown" — nothing
 * breaks, the geo charts just show fewer slices.
 *
 * No external IP-lookup API is called, keeping this free and fast.
 */

export type GeoInfo = {
  country: string | null;
  city: string | null;
};

/**
 * Read Cloudflare geo headers from a header-lookup function.
 *
 * Accepts a getter (so it works identically in Route Handlers, where you pass
 * `(name) => req.headers.get(name)`, and in Server Components, where you pass
 * `(name) => headersMap.get(name)` from next/headers).
 */
export function parseGeo(getHeader: (name: string) => string | null): GeoInfo {
  // Cloudflare country is an ISO-3166-1 alpha-2 code, e.g. "GB", "US", "NG".
  const country = getHeader("cf-ipcountry")?.trim() || null;
  // Cloudflare city is a free-text string, e.g. "London".
  const city = getHeader("cf-ipcity")?.trim() || null;
  return { country, city };
}
