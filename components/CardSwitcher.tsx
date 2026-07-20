"use client";

import Spinner from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CardSummary = {
  id: string;
  slug: string;
  label: string;
  is_primary: boolean;
};

/**
 * CardSwitcher — lets the owner switch between their cards + create new ones.
 *
 * SECURITY
 * --------
 * - Card creation is gated by the DB trigger `enforce_card_limit` (Free=1,
 *   Pro=3, Exempt=unlimited). The client UI is just a convenience — even if
 *   a free user bypasses the button, the DB rejects the INSERT.
 * - Slug validation (format + reserved words + username-prefix) is enforced
 *   by the `validate_card_slug` trigger. The client pre-validates for UX.
 */
export default function CardSwitcher({
  cards,
  currentCardId,
  username,
  maxCards = 1,
}: {
  cards: CardSummary[];
  currentCardId: string;
  username: string;
  maxCards?: number;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newCardSlug, setNewCardSlug] = useState("");
  const [newCardLabel, setNewCardLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const slugSuffix = newCardSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const fullSlug = `${username}-${slugSuffix}`;
  const slugValid = slugSuffix.length >= 2 && /^[a-z0-9-]+$/.test(slugSuffix);

  const handleSwitch = async (cardId: string) => {
    if (cardId === currentCardId) return;
    setSwitchingId(cardId);
    try {
      const supabase = createClient();
      // Update active_card_id (the switcher state)
      await supabase.from("profiles").update({ active_card_id: cardId }).eq("id", (await supabase.auth.getUser()).data.user?.id);
      // Navigate to that card's edit page
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        router.push(`/${card.slug}/edit`);
      }
    } catch {
      toast.error("Couldn't switch cards");
      setSwitchingId(null);
    }
    // Note: switchingId is intentionally not reset on success because the
    // router.push() triggers a navigation that swaps the view (the new edit
    // page's loading.tsx takes over the loading UX).
  };

  const handleCreate = async () => {
    if (!slugValid) {
      toast.error("Slug must be 2+ characters (letters, numbers, hyphens only)");
      return;
    }
    setCreating(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not logged in"); return; }

      const { data, error } = await supabase
        .from("cards")
        .insert({
          owner_id: user.id,
          slug: fullSlug,
          label: newCardLabel || fullSlug,
          full_name: "",
          is_primary: false,
          sort_order: cards.length,
        })
        .select("id, slug")
        .single();

      if (error) {
        // The DB trigger will reject if over limit or slug invalid
        toast.error(error.message);
        return;
      }

      toast.success("Card created!");
      setShowCreate(false);
      setNewCardSlug("");
      setNewCardLabel("");
      router.push(`/${data.slug}/edit`);
    } catch {
      toast.error("Could not create card");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          My Cards ({cards.length})
        </span>
        {/* maxCards of Infinity = exempt user (unlimited). Otherwise respect
            the plan limit. Use Number.isFinite so Infinity isn't < anything. */}
        {(maxCards === Infinity || cards.length < maxCards) && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="cursor-pointer text-xs font-medium text-(--main-orange) hover:underline"
          >
            + New Card
          </button>
        )}
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-1">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={switchingId !== null}
            onClick={() => handleSwitch(card.id)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
              card.id === currentCardId
                ? "bg-(--main-orange)/10 text-(--main-orange) ring-1 ring-(--main-orange)/20"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            } disabled:cursor-not-allowed`}
          >
            <div className="flex flex-col">
              <span className="font-medium">
                {card.label || card.slug}
                {card.is_primary && (
                  <span className="ml-1 text-[10px] text-zinc-400">★ primary</span>
                )}
              </span>
              <span className="text-[10px] text-zinc-400">/{card.slug}</span>
            </div>
            {switchingId === card.id ? (
              <Spinner size="sm" className="text-(--main-orange)" />
            ) : (
              card.id === currentCardId && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )
            )}
          </button>
        ))}
      </div>

      {/* Create new card form */}
      {showCreate && (
        <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
          <h4 className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Create new card</h4>

          {/* Label (owner-facing name) */}
          <label className="mb-1 block text-[10px] text-zinc-400">Card name (for you)</label>
          <input
            type="text"
            value={newCardLabel}
            onChange={(e) => setNewCardLabel(e.target.value)}
            placeholder="e.g. Design Client Card"
            className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />

          {/* Slug (URL) */}
          <label className="mb-1 block text-[10px] text-zinc-400">Card URL</label>
          <div className="flex items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-zinc-400">konneqta.com/{username}-</span>
            <input
              type="text"
              value={newCardSlug}
              onChange={(e) => setNewCardSlug(e.target.value)}
              placeholder="design"
              className="flex-1 bg-transparent text-zinc-900 outline-none dark:text-zinc-50"
            />
          </div>
          {slugSuffix && !slugValid && (
            <p className="mt-1 text-[10px] text-red-500">Letters, numbers, hyphens only (min 2 chars)</p>
          )}
          {slugValid && (
            <p className="mt-1 text-[10px] text-green-600 dark:text-green-400">URL: konneqta.com/{fullSlug}</p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!slugValid || creating}
              className="flex items-center justify-center gap-1.5 flex-1 rounded-md bg-(--main-orange) px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}