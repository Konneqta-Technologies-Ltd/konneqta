/**
 * schema.org WebSite JSON-LD builder for Konneqta.
 *
 * Describes the Konneqta site itself to search engines. Typically rendered on
 * the root layout so it appears on every page.
 */

export type WebsiteSchemaInput = {
  /** Absolute base URL, e.g. "https://www.konneqta.com". */
  baseUrl: string;
};

export function buildWebsiteSchema({ baseUrl }: WebsiteSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Konneqta",
    url: baseUrl,
    description: "Connect Smarter, Beyond The Internet",
  };
}