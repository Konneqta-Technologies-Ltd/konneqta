-- =============================================================================
-- FIX: Add `theme_custom` to the `cards` table + sync theme data
-- =============================================================================
-- PROBLEM
-- -------
-- The public profile page (app/[username]/page.tsx) reads `theme` and
-- `banner_url` from the `cards` table, and the ProfileCard component
-- expects a `theme_custom` field too. But:
--   1. `theme_custom` was NEVER created on `cards` (only on `profiles`).
--   2. `theme` + `banner_url` exist on BOTH tables, but the appearance
--      editor (AppearanceModal.tsx) writes them to `profiles` — so the
--      public page (which reads `cards`) never sees the user's choices.
--
-- This caused the "Profile not found" bug: the SELECT included a
-- non-existent column, PostgREST threw a schema-cache error, and the
-- query returned null even though the card row existed.
--
-- WHAT THIS SCRIPT DOES
-- ---------------------
-- 1. Adds `theme_custom` (jsonb) to BOTH `cards` and `profiles` (it was
--    never created on either, so writes AND reads were both broken).
-- 2. Backfills `theme`, `banner_url`, and `theme_custom` from `profiles`
--    into each user's PRIMARY card (so existing appearance choices survive).
-- 3. Creates a trigger that auto-syncs future profiles.theme/banner_url/
--    theme_custom writes onto the owner's primary card — so the existing
--    AppearanceModal.tsx / ThemeCustomizer.tsx (which write to profiles)
--    keep working until they are migrated to write to cards directly.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run (idempotent).
-- =============================================================================
-- 1. Add `theme_custom` to BOTH tables. It was never created on either
--    (not in phase2-themes-banners.sql, not in phase4-multi-card.sql),
--    so both the ThemeCustomizer writes (profiles) and the public-page
--    reads (cards) were silently failing.
alter table public.cards
add column if not exists theme_custom jsonb;
alter table public.profiles
add column if not exists theme_custom jsonb;
-- 2. Backfill appearance columns from profiles → primary card.
--    Only touches the primary card so secondary cards keep their own themes.
update public.cards c
set theme = coalesce(p.theme, c.theme, 'classic'),
    banner_url = coalesce(p.banner_url, c.banner_url),
    theme_custom = coalesce(p.theme_custom, c.theme_custom)
from public.profiles p
where c.owner_id = p.id
    and c.is_primary = true;
-- 3. Sync function: whenever a profile's appearance columns change,
--    mirror them onto that user's primary card. This keeps the public page
--    (which reads cards) consistent with the editors (which write profiles)
--    without requiring a full code migration today.
create or replace function public.sync_profile_appearance_to_primary_card() returns trigger language plpgsql as $$ begin
update public.cards
set theme = coalesce(new.theme, theme, 'classic'),
    banner_url = coalesce(new.banner_url, banner_url),
    theme_custom = coalesce(new.theme_custom, theme_custom)
where owner_id = new.id
    and is_primary = true;
return new;
end;
$$;
-- Drop + recreate the trigger (idempotent).
drop trigger if exists profiles_sync_appearance on public.profiles;
create trigger profiles_sync_appearance
after
update of theme,
    banner_url,
    theme_custom on public.profiles for each row execute function public.sync_profile_appearance_to_primary_card();
-- =============================================================================
-- VERIFICATION (run after)
-- =============================================================================
-- Every primary card should now carry a theme:
--   select slug, theme, banner_url, theme_custom is not null as has_custom
--   from cards where is_primary = true;
--
-- After changing appearance in the app, the card row should update:
--   select c.slug, c.theme, p.theme as profile_theme
--   from cards c join profiles p on p.id = c.owner_id
--   where c.is_primary = true;
-- =============================================================================