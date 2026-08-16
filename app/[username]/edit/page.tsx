import { canUploadLogo, getMaxCards, getMaxSocialLinks } from "@/lib/entitlements";

import EditProfileForm from "@/components/EditProfileForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // 1. Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // 2. Fetch the card by slug
  //    phone + show_phone are now PER-CARD (moved off profiles) so each card
  //    can have its own contact number. Run fix-card-creation-and-per-card-phone.sql.
  const { data: card } = await supabase
    .from("cards")
    .select("id, owner_id, slug, full_name, job_title, company, bio, avatar_url, logo_url, qr_code_url, is_primary, phone, show_phone")
    .eq("slug", username)
    .maybeSingle();

  if (!card) {
    redirect("/");
  }

  // 3. Ownership check — only the card owner can edit
  if (card.owner_id !== user.id) {
    redirect(`/${username}`);
  }

  // 4. Fetch account-level fields from profiles (email, username, entitlements)
  //    phone + show_phone have MOVED to cards (per-card). Only email and the
  //    immutable username live on profiles now.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, email, plan, is_exempt, pro_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/");
  }

  // 5. Fetch the card's existing social links
  const { data: socialLinks } = await supabase
    .from("social_links")
    .select("id, platform, url, label")
    .eq("card_id", card.id)
    .order("created_at", { ascending: true });

  // 6. Fetch all the owner's cards (for the switcher)
  const { data: allCards } = await supabase
    .from("cards")
    .select("id, slug, label, is_primary")
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true });

  return (
    <EditProfileForm
      initialProfile={{
        username: profile.username,
        email: profile.email ?? "",
        full_name: card.full_name ?? "",
        job_title: card.job_title ?? "",
        company: card.company ?? "",
        // phone + show_phone are PER-CARD now (not account-level)
        phone: card.phone ?? "",
        show_phone: card.show_phone ?? false,
        bio: card.bio ?? "",
        avatar_url: card.avatar_url ?? "",
        logo_url: card.logo_url ?? "",
        qr_code_url: card.qr_code_url,
      }}
      initialSocialLinks={socialLinks ?? []}
      canUploadLogo={canUploadLogo(profile)}
      maxCards={getMaxCards(profile)}
      maxSocialLinks={getMaxSocialLinks(profile)}
      // New multi-card props:
      cardId={card.id}
      cardSlug={card.slug}
      isPrimaryCard={card.is_primary}
      allCards={allCards ?? []}
    />
  );
}