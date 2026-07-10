-- =============================================================================
-- FIX: Exempt usernames not honoured by DB triggers
-- =============================================================================
-- PROBLEM
-- -------
-- The client-side isExempt() helper (lib/entitlements.ts) checks BOTH:
--   1. profiles.is_exempt = true   (database flag)
--   2. profiles.username IN hardcoded EXEMPT_USERNAMES list  (e.g. 'vicwin13')
--
-- But the DB trigger enforce_card_limit() ONLY checks the is_exempt column.
-- So if the column isn't set (e.g. entitlements-setup.sql wasn't run, or a
-- new exempt username was added to the code but not the DB), the trigger
-- blocks card creation even though the client shows unlimited cards.
--
-- This makes the trigger mirror the client logic exactly: bypass the limit
-- if EITHER the is_exempt flag is set OR the username is in the exempt list.
--
-- HOW TO RUN
-- ----------
-- Run in Supabase SQL Editor. Safe to re-run (CREATE OR REPLACE).
-- To add more exempt usernames, edit the IN (...) list below.
-- =============================================================================
create or replace function public.enforce_card_limit() returns trigger language plpgsql as $$
declare v_plan text;
v_exempt boolean;
v_username text;
v_current_count integer;
v_max integer;
begin -- Fetch the owner's entitlements + username in one shot
select plan,
    is_exempt,
    username into v_plan,
    v_exempt,
    v_username
from public.profiles
where id = new.owner_id;
-- Bypass if the database flag is set ...
if v_exempt then return new;
end if;
-- ... OR if the username is in the hardcoded exempt list.
-- This mirrors lib/entitlements.ts EXEMPT_USERNAMES exactly.
-- Add more usernames here as needed.
if v_username in ('vicwin13') then return new;
end if;
-- Otherwise enforce the plan limit
select count(*) into v_current_count
from public.cards
where owner_id = new.owner_id;
v_max := case
    when v_plan = 'pro' then 3
    else 1
end;
if v_current_count >= v_max then raise exception 'Card limit reached (%)',
case
    when v_plan = 'pro' then '3 cards for Pro'
    else '1 card for Free — upgrade to Pro for more'
end;
end if;
return new;
end;
$$;
-- The trigger itself already exists (created in phase4-multi-card.sql).
-- CREATE OR REPLACE FUNCTION updates it in place — no need to drop/recreate
-- the trigger. But we do it anyway for safety.
drop trigger if exists cards_enforce_limit on public.cards;
create trigger cards_enforce_limit before
insert on public.cards for each row execute function public.enforce_card_limit();
-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After running, vicwin13 (or any exempt username) can create unlimited cards
-- regardless of the is_exempt column value.
--
-- To also set the DB flag (belt + suspenders), uncomment and run:
--   update public.profiles set is_exempt = true, plan = 'pro'
--    where username = 'vicwin13';
-- =============================================================================