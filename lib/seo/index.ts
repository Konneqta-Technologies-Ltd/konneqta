/**
 * SEO helpers — schema.org JSON-LD builders for Konneqta.
 *
 * Reusable so any route can emit structured data without duplicating logic:
 *   import { buildPersonSchema } from "@/lib/seo";
 */

export {
  buildPersonSchema,
  type PersonSchemaInput,
  type SocialLinkForSchema,
} from "./person-schema";
export { buildOrganizationSchema, type OrganizationSchemaInput } from "./organization-schema";
export { buildWebsiteSchema, type WebsiteSchemaInput } from "./website-schema";