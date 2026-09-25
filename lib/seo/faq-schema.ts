/**
 * schema.org FAQPage JSON-LD builder for the Konneqta landing page.
 *
 * Generates structured data from the SAME FAQ array the page renders
 * (components/home/faq-data.ts) so Google always sees Q&A that matches the
 * visible content — a requirement for FAQ rich results and a manual-action
 * safeguard.
 *
 * Usage (in a Server Component):
 *   const schema = buildFaqSchema(FAQS);
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
 */

/** Structural type matching components/home/faq-data.ts `FaqItem`. */
export type FaqSchemaItem = {
  q: string;
  a: string;
};

export function buildFaqSchema(items: readonly FaqSchemaItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
