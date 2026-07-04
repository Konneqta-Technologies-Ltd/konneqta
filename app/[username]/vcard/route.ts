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
 * - Phone is fetched from the OWNER's profile (account-level), not the card,
 *   and is included in the output only when show_phone is TRUE and non-empty.
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

  // Look up the card by slug
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug, full_name")
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    return new Response("Not Found", { status: 404 });
  }

  // Fetch phone + show_phone from the owner's profile (account-level)
  const { data: owner } = await supabase
    .from("profiles")
    .select("phone, show_phone")
    .eq("id", card.owner_id)
    .maybeSingle();

  // Build the canonical profile URL from the incoming request host.
  const url = new URL(_req.url);
  const profileUrl = `${url.origin}/${card.slug}`;

  const vcf = buildVCard({
    fullName: card.full_name,
    username: card.slug,
    profileUrl,
    phone: owner?.phone ?? null,
    showPhone: owner?.show_phone ?? false,
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