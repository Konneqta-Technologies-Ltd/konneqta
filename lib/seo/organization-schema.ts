/**
 * schema.org Organization JSON-LD builder for Konneqta.
 *
 * Describes Konneqta as an organization to search engines. Used on the root
 * layout or marketing pages.
 */

export type OrganizationSchemaInput = {
  /** Absolute base URL, e.g. "https://www.konneqta.com". */
  baseUrl: string;
  logoUrl?: string;
};

export function buildOrganizationSchema({
  baseUrl,
  logoUrl,
}: OrganizationSchemaInput) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Konneqta",
    url: baseUrl,
    description: "Connect Smarter, Beyond The Internet",
  };

  if (logoUrl) {
    schema.logo = logoUrl;
  }

  return schema;
}