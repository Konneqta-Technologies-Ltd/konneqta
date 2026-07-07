-- =============================================================================
-- FIX: Backfill missing primary cards for existing profiles
-- =============================================================================
-- PROBLEM
-- -------
-- OnboardingForm.tsx (before the fix) inserted a row into `profiles` but
-- NEVER created the corresponding `cards` row. The public profile page
-- (app/[username]/page.tsx) reads from `cards` by slug, so affected users
-- see a redirect loop:
--
--   /post-login → profile exists → /<username>
--   /<username> → no card found → redirect('/')
--   /           → logged in → Login/Signup buttons → /post-login → loop
--
-- SYMPTOM
-- -------
-- A user signs up via Google, completes onboarding, lands back on /home
-- and can't reach their profile. The TypeError: transformAlgorithm error
-- is a downstream symptom of the redirect bounce in Next.js 16 streaming.
--
-- THIS SCRIPT
-- ----------
-- For every profile that has NO card yet, create the primary card from the
-- profile's current data and point active_card_id at it. Safe to re-run
-- (only touches profiles with zero cards).
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- =============================================================================
-- 1. Create a primary card for every profile that doesn't have one.
--    Mirrors exactly what the fixed OnboardingForm.tsx now does.
insert into public.cards (
        owner_id,
        slug,
        label,
        full_name,
        job_title,
        company,
        bio,
        avatar_url,
        logo_url,
        qr_code_url,
        theme,
        banner_url,
        is_primary,
        sort_order
    )
select p.id,
    p.username,
    'Primary',
    p.full_name,
    p.job_title,
    p.company,
    p.bio,
    p.avatar_url,
    p.logo_url,
    p.qr_code_url,
    coalesce(p.theme, 'classic'),
    p.banner_url,
    true,
    0
from public.profiles p
where not exists (
        select 1
        from public.cards c
        where c.owner_id = p.id
    );
-- 2. Point active_card_id at the new primary card for users who had none.
update public.profiles p
set active_card_id = c.id
from public.cards c
where c.owner_id = p.id
    and c.is_primary = true
    and p.active_card_id is null;
-- 3. Repoint any orphaned social_links (those with a profile_id but no
--    card_id) onto the owner's primary card.
update public.social_links sl
set card_id = c.id
from public.cards c
where c.owner_id = sl.profile_id
    and c.is_primary = true
    and sl.card_id is null;
-- =============================================================================
-- VERIFICATION QUERIES (run these to confirm the fix worked)
-- =============================================================================
-- Every profile should now have exactly one primary card:
--   select p.username, c.slug, c.is_primary, p.active_card_id
--   from profiles p left join cards c on c.owner_id = p.id
--   where c.is_primary = true;
--
-- Any profiles STILL without a card? (should return 0 rows):
--   select p.username
--   from profiles p
--   where not exists (select 1 from cards c where c.owner_id = p.id);
-- =============================================================================