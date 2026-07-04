-- =============================================================================
-- ENTITLEMENTS FOUNDATION (Phase 0)
-- =============================================================================
-- WHAT THIS FILE DOES
-- --------------------
-- 1. Adds `plan` and `is_exempt` columns to `profiles`.
-- 2. Creates a trigger that makes those two columns UNWRITABLE by user JWTs
--    — only the service-role key (your Flutterwave webhook, manual SQL) can
--    change them. This is the anti-backdoor gate.
-- 3. Grants your builder account (`vicwin13`) full exemption: all Pro features,
--    no restrictions, forever — without paying.
--
-- HOW TO RUN
-- ----------
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run (idempotent).
--
-- ORDER MATTERS
-- -------------
-- Run this BEFORE any application code tries to read `plan` or `is_exempt`.
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. Add entitlement columns to `profiles`
-- -----------------------------------------------------------------------------
-- `plan` controls which Pro features a user can access.
--   'free' = default, no Pro features.
--   'pro'  = paying subscriber (or exempt).
alter table public.profiles
add column if not exists plan text not null default 'free';
-- Add CHECK constraint to ensure only valid values
alter table public.profiles drop constraint if exists profiles_plan_valid;
alter table public.profiles
add constraint profiles_plan_valid check (plan in ('free', 'pro'));
-- `is_exempt` is the builder/staff override.
--   true  = this user gets ALL Pro features + no username restrictions,
--           regardless of `plan`. Inherits to all their cards automatically.
--   false = normal user, subject to plan limits.
alter table public.profiles
add column if not exists is_exempt boolean not null default false;
-- -----------------------------------------------------------------------------
-- 2. ANTI-BACKDOOR TRIGGER: lock `plan` and `is_exempt` to service-role only
-- -----------------------------------------------------------------------------
-- This is the REAL security barrier for entitlements.
--
-- Without it, a user could open the browser console and run:
--   supabase.from('profiles').update({ plan: 'pro' }).eq('id', theirId)
-- …and give themselves Pro for free.
--
-- This trigger intercepts EVERY insert and update on `profiles`:
--   - If the caller is using the SERVICE ROLE key → allow (webhook, manual SQL).
--   - If the caller is using a user JWT (anon/authenticated) → strip the
--     entitlement columns back to their existing/default values, ignoring
--     whatever the client sent.
--
-- The user's app never needs to send these columns anyway (the forms only
-- update username, bio, avatar, etc.), so this trigger is invisible to
-- legitimate traffic.
-- -----------------------------------------------------------------------------
create or replace function public.protect_entitlements() returns trigger language plpgsql as $$ begin -- Service role (your webhook, manual admin SQL) can write anything.
    if auth.role() = 'service_role' then return new;
end if;
-- Everyone else (authenticated users, anon): lock the entitlement fields.
if tg_op = 'INSERT' then -- New signup: force defaults. The service role will upgrade later if needed.
new.plan := 'free';
new.is_exempt := false;
else -- UPDATE: preserve whatever is already in the row, ignoring client payload.
new.plan := old.plan;
new.is_exempt := old.is_exempt;
end if;
return new;
end;
$$;
-- Drop and recreate the trigger (idempotent).
drop trigger if exists profiles_protect_entitlements on public.profiles;
create trigger profiles_protect_entitlements before
insert
    or
update of plan,
    is_exempt on public.profiles for each row execute function public.protect_entitlements();
-- Also fire on general updates (in case the update payload includes plan/is_exempt
-- alongside other columns). The `of plan, is_exempt` clause above only fires when
-- those specific columns appear in the SET clause, but a malicious client could
-- include them. This broader trigger catches that.
drop trigger if exists profiles_protect_entitlements_all on public.profiles;
create trigger profiles_protect_entitlements_all before
update on public.profiles for each row
    when (
        new.plan is distinct
        from old.plan
            or new.is_exempt is distinct
        from old.is_exempt
    ) execute function public.protect_entitlements();
-- -----------------------------------------------------------------------------
-- 3. GRANT BUILDER EXEMPTION: vicwin13 gets everything, forever, free
-- -----------------------------------------------------------------------------
-- This uses the service-role context internally. Run this statement manually
-- (you are the admin in the SQL Editor, which has service_role).
--
-- To add more exempt users later, just add more usernames here and re-run.
-- -----------------------------------------------------------------------------
update public.profiles
set is_exempt = true,
    plan = 'pro'
where username = 'vicwin13';
-- (Optional) Add more exempt usernames here — uncomment and edit:
-- update public.profiles
--   set is_exempt = true, plan = 'pro'
--   where username in ('vicwin13', 'other_username');
-- -----------------------------------------------------------------------------
-- 4. VERIFICATION QUERIES (run these to confirm it worked)
-- -----------------------------------------------------------------------------
-- Confirm the columns exist and have the right defaults:
--   select username, plan, is_exempt from profiles limit 10;
-- Confirm the trigger is active:
--   select tgname, tgtype from pg_trigger where tgrelid = 'profiles'::regclass;
-- CONFIRM THE BACKDOOR IS CLOSED — this should FAIL with an error:
--   (Run this as an authenticated user, NOT in the SQL editor which is admin)
--   update profiles set plan = 'pro' where username = 'some_free_user';
--   → the trigger will silently keep plan = 'free'.
-- =============================================================================