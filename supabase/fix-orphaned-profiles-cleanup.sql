-- =============================================================================
-- FIX: Clean up orphaned profiles + auto-cleanup on auth user deletion
-- =============================================================================
-- PROBLEM
-- -------
-- 1. Deleting an auth user (Dashboard/API/SQL) leaves orphaned rows in
--    `profiles` + `cards` because there's no cleanup trigger on auth.users.
--    Result: usernames like 'vicwin13', 'vicwin23' stay "taken" forever.
--
-- 2. The `protect_primary_card()` trigger blocks ALL card deletions — even
--    by the service_role — so /api/delete-account and admin cleanup fail
--    with "Cannot delete your primary card".
--
-- THIS SCRIPT (robust combined fix):
--   A. Patches protect_primary_card() to exempt the service_role
--      (fixes the explicit card delete in /api/delete-account).
--   B. Installs an event trigger on auth.users that auto-cleans
--      cards + profiles on ANY auth user deletion (Dashboard/API/SQL),
--      using session_replication_role = 'replica' to bypass the trigger.
--   C. One-time bulk cleanup of EXISTING orphans, also using replica mode.
--
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent).
-- =============================================================================
-- -----------------------------------------------------------------------------
-- A. PATCH protect_primary_card() — exempt service_role
-- -----------------------------------------------------------------------------
-- /api/delete-account deletes cards explicitly (line 98) BEFORE deleting the
-- auth user. Without this patch, that line raises "Cannot delete your primary
-- card". service_role bypasses the block (same pattern as protect_entitlements).
create or replace function public.protect_primary_card() returns trigger language plpgsql as $$ begin -- Service role (delete-account API route, admin SQL) can do anything.
    if auth.role() = 'service_role' then return new;
end if;
if tg_op = 'DELETE'
and old.is_primary = true then raise exception 'Cannot delete your primary card';
end if;
if tg_op = 'UPDATE'
and old.is_primary = true
and (
    new.is_primary = false
    or new.is_primary is null
) then raise exception 'Cannot remove primary status from card #1';
end if;
return new;
end;
$$;
-- -----------------------------------------------------------------------------
-- B. AUTO-CLEANUP TRIGGER on auth.users (the permanent fix)
-- -----------------------------------------------------------------------------
-- Fires BEFORE DELETE on auth.users. Whenever ANY auth user is deleted — via
-- the Dashboard, the /api/delete-account route, or raw SQL — this cleans up
-- their cards + profiles first.
--
-- session_replication_role = 'replica' disables ALL triggers/rules for the
-- transaction, so protect_primary_card() can't block the card delete.
-- SECURITY DEFINER + the postgres role (SQL Editor) make this work.
drop trigger if exists on_auth_user_deleted_cleanup on auth.users;
drop function if exists public.handle_auth_user_deletion_cleanup();
create or replace function public.handle_auth_user_deletion_cleanup() returns trigger language plpgsql security definer as $$ begin -- Bypass ALL triggers (incl. protect_primary_card) for this transaction.
    perform set_config('session_replication_role', 'replica', true);
-- Delete the user's cards (social_links cascade via their FK).
delete from public.cards
where owner_id = old.id;
-- Delete the profile row (frees the username).
delete from public.profiles
where id = old.id;
-- Restore normal trigger behaviour.
perform set_config('session_replication_role', 'origin', true);
return old;
end;
$$;
create trigger on_auth_user_deleted_cleanup before delete on auth.users for each row execute function public.handle_auth_user_deletion_cleanup();
-- -----------------------------------------------------------------------------
-- C. ONE-TIME BULK CLEANUP of existing orphans
-- -----------------------------------------------------------------------------
-- The trigger above only fires on FUTURE deletions. Existing orphaned rows
-- (profiles/cards whose auth user is already gone) need a manual sweep.
-- We use replica mode here too, so protect_primary_card can't block it.
perform set_config('session_replication_role', 'replica', true);
-- 1. Orphaned cards (no matching profile) — delete first (FK order).
delete from public.cards c
where not exists (
        select 1
        from public.profiles p
        where p.id = c.owner_id
    );
-- 2. Orphaned profiles (auth user already deleted) — frees the usernames.
delete from public.profiles p
where not exists (
        select 1
        from auth.users au
        where au.id = p.id
    );
perform set_config('session_replication_role', 'origin', true);
-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Orphaned profiles remaining? (should be 0):
--   select count(*) from public.profiles p
--   where not exists (select 1 from auth.users au where au.id = p.id);
--
-- Orphaned cards remaining? (should be 0):
--   select count(*) from public.cards c
--   where not exists (select 1 from public.profiles p where p.id = c.owner_id);
--
-- Confirm the trigger exists:
--   select tgname from pg_trigger where tgname = 'on_auth_user_deleted_cleanup';
-- =============================================================================