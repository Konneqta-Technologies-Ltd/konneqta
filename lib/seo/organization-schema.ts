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
  /** Public support email — emitted as a schema.org ContactPoint. */
  contactEmail?: string;
};

export function buildOrganizationSchema({
  baseUrl,
  logoUrl,
  contactEmail,
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

  // ContactPoint ties the brand entity to its public contact channel in
  // Google's knowledge graph (complements the visible Contact page).
  if (contactEmail) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: contactEmail,
    };
  }

  return schema;
}