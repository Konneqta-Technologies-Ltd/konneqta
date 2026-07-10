import { buildVCard } from "@/lib/vcard";
import { createClient } from "@/lib/supabase/server";

/**
 * vCard (.vcf) download route.
 *
 * Serves a live, thin vCard generated from the current card row.
 * Queries `cards` by slug (the URL segment).
 *
 * Privacy:
 * - Selects ONLY the columns it needs: full_name, slug, phone, show_phone.
 * - Phone + show_phone are PER-CARD (each card has its own number). Phone is
 *   included in the output only when show_phone is TRUE and non-empty.
 * - Email is never selected, never included.
 */

// Always dynamic — every request must hit the DB for fresh card data.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  const supabase = await createClient();

  // Look up the card by slug.
  // phone + show_phone are PER-CARD now (moved off profiles) so each card
  // has its own contact number.
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug, full_name, phone, show_phone")
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    return new Response("Not Found", { status: 404 });
  }

  // Build the canonical profile URL from the incoming request host.
  const url = new URL(_req.url);
  const profileUrl = `${url.origin}/${card.slug}`;

  const vcf = buildVCard({
    fullName: card.full_name,
    username: card.slug,
    profileUrl,
    phone: card.phone ?? null,
    showPhone: card.show_phone ?? false,
  });

  // Suggest a filename the OS will use for "Save Contact".
  const fileBase = (card.full_name || "contact").replace(
    /[^a-z0-9_-]/gi,
    ""
  );

  return new Response(vcf, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBase}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}