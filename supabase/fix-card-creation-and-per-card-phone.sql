-- =============================================================================
-- FIX: Card creation for exempt users + per-card phone number
-- =============================================================================
-- PROBLEM 1: vicwin13 (exempt user) cannot create additional cards.
--   The `enforce_card_limit()` trigger checks `profiles.is_exempt`, but if
--   the value is NULL (column exists but row never updated) or the
--   entitlements-setup.sql was never run, the trigger treats the user as
--   free-tier and blocks card creation at 1 card.
--
-- PROBLEM 2: Phone number is account-level (on `profiles`), not per-card.
--   The user wants each card to have its own phone number, job title,
--   company, bio, avatar, logo, theme, etc. Only email + username stay
--   account-level. This moves `phone` + `show_phone` to the `cards` table.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run (idempotent).
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. ENSURE EXEMPT USERS HAVE is_exempt = true
-- -----------------------------------------------------------------------------
-- The enforce_card_limit trigger reads is_exempt; if NULL, it's falsy and
-- blocks card creation. Force it to true for known exempt usernames.
update public.profiles
set is_exempt = true,
    plan = 'pro'
where username in ('vicwin13')
    and (
        is_exempt is null
        or is_exempt = false
    );
-- -----------------------------------------------------------------------------
-- 2. ADD `phone` + `show_phone` TO THE `cards` TABLE (per-card)
-- -----------------------------------------------------------------------------
alter table public.cards
add column if not exists phone text;
alter table public.cards
add column if not exists show_phone boolean not null default false;
-- -----------------------------------------------------------------------------
-- 3. BACKFILL: copy phone + show_phone from profiles → each card
-- -----------------------------------------------------------------------------
-- Every existing card inherits the owner's current phone number.
update public.cards c
set phone = p.phone,
    show_phone = coalesce(p.show_phone, false)
from public.profiles p
where c.owner_id = p.id
    and c.phone is null;
-- =============================================================================
-- VERIFICATION (run after)
-- =============================================================================
-- Confirm vicwin13 is exempt:
--   select username, plan, is_exempt from profiles where username = 'vicwin13';
--
-- Confirm cards now have phone columns:
--   select slug, phone, show_phone from cards limit 10;
-- =============================================================================