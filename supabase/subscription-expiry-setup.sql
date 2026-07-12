-- =============================================================================
-- SUBSCRIPTION EXPIRY (30-Day Pro Subscription)
-- =============================================================================
-- WHAT THIS FILE DOES
-- --------------------
-- 1. Adds `pro_expires_at` column to `profiles`.
-- 2. Updates the `protect_entitlements` trigger to also lock this column
--    (anti-backdoor: users cannot self-extend their subscription).
-- 3. Backfills existing Pro users with 30 days from when this runs.
--
-- HOW TO RUN
-- ----------
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run (idempotent).
--
-- PREREQUISITES
-- -------------
-- Run `entitlements-setup.sql` first.
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Add `pro_expires_at` column to `profiles`
-- -----------------------------------------------------------------------------
-- NULL = the user has never had Pro (or their subscription has lapsed and
--        the row was cleaned up by the optional cron below).
-- A timestamp = their Pro access is valid until this moment (inclusive).
alter table public.profiles
add column if not exists pro_expires_at timestamptz;
-- -----------------------------------------------------------------------------
-- 2. ANTI-BACKDOOR: lock `pro_expires_at` to service-role only
-- -----------------------------------------------------------------------------
-- Same security model as `plan` and `is_exempt`: only the service role
-- (Flutterwave webhook, verify route) can set/extend the expiry.
-- A user JWT trying to update this column will have it silently ignored.
--
-- We REPLACE the existing protect_entitlements() function so it also guards
-- pro_expires_at. The function signature/behaviour is identical except it
-- now strips an extra column for non-service-role callers.
-- -----------------------------------------------------------------------------
create or replace function public.protect_entitlements() returns trigger language plpgsql as $$ begin -- Service role (your webhook, manual admin SQL) can write anything.
    if auth.role() = 'service_role' then return new;
end if;
-- Everyone else (authenticated users, anon): lock the entitlement fields.
if tg_op = 'INSERT' then -- New signup: force defaults.
new.plan := 'free';
new.is_exempt := false;
new.pro_expires_at := null;
else -- UPDATE: preserve whatever is already in the row, ignoring client payload.
new.plan := old.plan;
new.is_exempt := old.is_exempt;
new.pro_expires_at := old.pro_expires_at;
end if;
return new;
end;
$$;
-- The triggers from entitlements-setup.sql already call protect_entitlements().
-- Since we replaced the function body, they automatically enforce pro_expires_at.
-- (No need to drop/recreate the triggers — they call the same function name.)
-- -----------------------------------------------------------------------------
-- 3. BACKFILL: give existing Pro users 30 days from now
-- -----------------------------------------------------------------------------
-- Users who already have plan='pro' (e.g. vicwin13, or anyone who paid before
-- this migration) get a 30-day window starting now. Exempt users get NULL
-- (they bypass expiry entirely).
-- -----------------------------------------------------------------------------
update public.profiles
set pro_expires_at = now() + interval '30 days'
where plan = 'pro'
    and is_exempt = false
    and pro_expires_at is null;
-- Exempt users never expire — keep their column NULL as a sentinel.
update public.profiles
set pro_expires_at = null
where is_exempt = true;
-- -----------------------------------------------------------------------------
-- 4. (OPTIONAL) pg_cron: daily cleanup of expired subscriptions
-- -----------------------------------------------------------------------------
-- This is NOT required for correctness — the application's isPro() check
-- handles expiry lazily at read time. But keeping the DB tidy makes admin
-- queries cleaner (you can filter by plan='pro' and get only active subs).
--
-- To enable, first run:  create extension if not exists pg_cron;
-- Then uncomment the block below:
--
-- select cron.schedule(
--   'expire-pro-subscriptions',
--   '0 3 * * *',  -- daily at 03:00 UTC
--   $$
--     update public.profiles
--     set plan = 'free'
--     where plan = 'pro'
--       and is_exempt = false
--       and pro_expires_at is not null
--       and pro_expires_at < now();
--   $$
-- );
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 5. UPDATE enforce_card_limit(): account for subscription expiry
-- -----------------------------------------------------------------------------
-- The card-limit trigger (phase4-multi-card.sql) checks `plan = 'pro'` to
-- allow 3 cards. But with expiry, `plan` might still say 'pro' even though
-- the subscription has lapsed (lazy evaluation). This patch makes the
-- trigger also check pro_expires_at so expired users are correctly limited
-- to 1 card (free tier).
create or replace function public.enforce_card_limit() returns trigger language plpgsql as $$
declare v_plan text;
v_exempt boolean;
v_username text;
v_pro_expires_at timestamptz;
v_current_count integer;
v_max integer;
v_effective_plan text;
begin
select plan,
    is_exempt,
    username,
    pro_expires_at into v_plan,
    v_exempt,
    v_username,
    v_pro_expires_at
from public.profiles
where id = new.owner_id;
-- Bypass if the database flag is set OR the username is in the hardcoded
-- exempt list.
if v_exempt then return new;
end if;
if v_username in ('vicwin13') then return new;
end if;
-- Resolve effective plan: 'pro' only if not expired.
v_effective_plan := v_plan;
if v_plan = 'pro'
and v_pro_expires_at is not null
and v_pro_expires_at < now() then v_effective_plan := 'free';
end if;
select count(*) into v_current_count
from public.cards
where owner_id = new.owner_id;
v_max := case
    when v_effective_plan = 'pro' then 3
    else 1
end;
if v_current_count >= v_max then raise exception 'Card limit reached (%)',
case
    when v_effective_plan = 'pro' then '3 cards for Pro'
    else '1 card for Free — upgrade to Pro for more'
end;
end if;
return new;
end;
$$;
-- =============================================================================
-- VERIFICATION QUERIES (run these to confirm it worked)
-- -----------------------------------------------------------------------------
-- Confirm the column exists:
--   select username, plan, is_exempt, pro_expires_at from profiles limit 10;
-- Confirm the trigger still fires (should be 2 triggers from entitlements-setup):
--   select tgname from pg_trigger where tgrelid = 'profiles'::regclass;
-- =============================================================================