import { getAdminClient, recordEvent } from "@/lib/analytics/server";

import { buildVCard } from "@/lib/vcard";
import { createClient } from "@/lib/supabase/server";
import { getVisitorId } from "@/lib/analytics/visitor";

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
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug, full_name, phone, show_phone")
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    return new Response("Not Found", { status: 404 });
  }

  // DEACTIVATED ACCOUNT: hide the vCard too — the profile behaves as if it
  // doesn't exist across every public surface.
  const { data: owner } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", card.owner_id)
    .maybeSingle();

  if (owner?.status === "deactivated") {
    return new Response("Not Found", { status: 404 });
  }

  // Build the canonical profile URL from the production site URL (set via
  // NEXT_PUBLIC_SITE_URL). Using the request Host header is unreliable behind
  // reverse proxies / load balancers and previously baked `localhost` into the
  // vCard URL field. This mirrors the pattern used in lib/qr.ts and
  // app/[username]/page.tsx.
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.konneqta.com"
  ).replace(/\/$/, "");
  const profileUrl = `${origin}/${card.slug}`;

  // ── ANALYTICS: vCard download (fire-and-forget) ──────────────────────
  const visitorId = await getVisitorId();
  void recordEvent({
    owner_id: card.owner_id,
    card_id: card.id,
    event_type: "vcard_download",
    visitor_id: visitorId,
  });

  // Award FIRST_VCARD_DOWNLOAD feedback milestone (one-time, atomic) to the
  // card OWNER (not the visitor). Uses the service-role client since this is
  // a public route with no auth session. Fire-and-forget — wrapped in a
  // catch so a missing SERVICE_ROLE_KEY or a DB error never breaks the .vcf.
  void (async () => {
    try {
      const { error } = await getAdminClient().rpc(
        "award_feedback_milestone",
        {
          p_user_id: card.owner_id,
          p_milestone: 8, // FIRST_VCARD_DOWNLOAD bit
        }
      );
      if (error) {
        console.warn("[vcard] feedback milestone RPC failed:", error.message);
      }
    } catch (err) {
      console.warn("[vcard] feedback milestone error (non-fatal):", err);
    }
  })();

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