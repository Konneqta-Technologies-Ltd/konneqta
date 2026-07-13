/**
 * schema.org Person JSON-LD builder for Konneqta profile pages.
 *
 * Generates structured data that tells search engines: "this page represents a
 * Person." This is the single strongest SEO signal for profile pages.
 *
 * Usage (in a Server Component):
 *   const schema = buildPersonSchema({ ... });
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
 */

/** Social platforms that represent "same person" identity (schema.org `sameAs`). */
// Excludes email, whatsapp, calendly, snapchat, telegram, wechat, "other" —
// those are contact methods, not identity profiles Google can verify.
const IDENTITY_PLATFORMS = new Set([
  "website",
  "linkedin",
  "github",
  "twitter",
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "reddit",
]);

export type SocialLinkForSchema = {
  platform: string;
  url: string;
};

export type PersonSchemaInput = {
  username: string;
  fullName: string | null;
  jobTitle?: string | null;
  company?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  socialLinks?: SocialLinkForSchema[];
  /** Absolute base URL, e.g. "https://www.konneqta.com". */
  baseUrl: string;
};

/**
 * Builds a schema.org Person object. Empty/null fields are omitted entirely
 * so the JSON-LD output stays clean.
 */
export function buildPersonSchema({
  username,
  fullName,
  jobTitle,
  company,
  bio,
  avatarUrl,
  socialLinks,
  baseUrl,
}: PersonSchemaInput) {
  const profileUrl = `${baseUrl}/${username}`;
  const name = fullName?.trim() || username;

  // Filter to identity platforms only, deduplicate, and collect valid URLs.
  const sameAs = Array.from(
    new Set(
      (socialLinks ?? [])
        .filter(
          (link) =>
            IDENTITY_PLATFORMS.has(link.platform) && link.url?.trim(),
        )
        .map((link) => link.url.trim()),
    ),
  );

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: profileUrl,
  };

  if (jobTitle?.trim()) {
    schema.jobTitle = jobTitle.trim();
  }

  if (company?.trim()) {
    schema.worksFor = {
      "@type": "Organization",
      name: company.trim(),
    };
  }

  if (bio?.trim()) {
    schema.description = bio.trim();
  }

  if (avatarUrl?.trim()) {
    schema.image = avatarUrl.trim();
  }

  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}