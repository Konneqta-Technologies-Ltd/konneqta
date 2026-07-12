-- =============================================================================
-- FIX: qrcodes bucket INSERT/UPDATE blocked by missing owner RLS policies
-- =============================================================================
-- THE SYMPTOM
-- -----------
-- During onboarding, after a new user creates their profile the QR generation
-- step logs:
--
--   qr upload error: StorageApiError: new row violates row-level security policy
--
-- The upload happens in components/OnboardingForm.tsx:
--
--   await supabase.storage
--     .from("qrcodes")
--     .upload(`${user.id}/qr.png`, qrBlob, { upsert: true, ... })
--
-- THE ROOT CAUSE
-- --------------
-- "new row violates row-level security policy" is Postgres's generic message
-- for: RLS is enabled on storage.objects AND this INSERT/UPDATE matched NO
-- policy's WITH CHECK. It is NOT an "unauthenticated" error (that would be a
-- 401 / JWT message).
--
-- Diagnosis confirmed the user IS authenticated during onboarding:
--   * app/onboarding/page.tsx server guard calls getUser() and redirects if null
--   * OnboardingForm.handleSubmit re-checks getUser() and bails if missing
--   * The avatar upload (same `to authenticated ... auth.uid()` guard) runs
--     BEFORE the QR upload and succeeds — so the session is valid
--
-- The real difference: the avatars bucket's write policies exist in the live
-- DB (see fix-avatars-upload-policy.sql), but the qrcodes bucket's write
-- policies from qr-setup.sql (lines 28-46) were never applied to the live
-- project. The bucket row exists (otherwise we'd get "Bucket not found"), but
-- with RLS enabled and no matching policy, writes are denied by default.
--
-- UPSERT REQUIRES BOTH POLICIES
-- -----------------------------
-- The upload uses upsert: true, which compiles to INSERT ... ON CONFLICT DO
-- UPDATE. Under RLS that means:
--   * when the object does NOT exist -> INSERT path -> needs an INSERT policy
--     with a WITH CHECK
--   * when the object DOES exist    -> UPDATE path -> needs an UPDATE policy
--     with USING (to select the existing row) AND WITH CHECK
-- So both the owner INSERT and owner UPDATE policies are mandatory.
--
-- THE FIX
-- -------
-- (Re)create the qrcodes bucket row and the owner-scoped SELECT / INSERT /
-- UPDATE / DELETE policies. All write policies key on the first path segment
-- equaling auth.uid(), matching the upload path convention `<user_id>/qr.png`.
-- Idempotent: DROP IF EXISTS first, then CREATE.
--
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query).
-- Safe to re-run.
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 0. Make sure the bucket exists and is public (read is public via RLS below).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('qrcodes', 'qrcodes', true) on conflict (id) do
update
set public = true;
-- -----------------------------------------------------------------------------
-- 1. Drop the known qrcodes policies so we end up with exactly one of each.
--    (Defensive: avoids duplicate-policy errors and OR-collapse surprises.)
-- -----------------------------------------------------------------------------
drop policy if exists "qrcodes_public_read" on storage.objects;
drop policy if exists "qrcodes_owner_insert" on storage.objects;
drop policy if exists "qrcodes_owner_update" on storage.objects;
drop policy if exists "qrcodes_owner_delete" on storage.objects;
-- -----------------------------------------------------------------------------
-- 1b. Nuke any STRAY broad qrcodes policy that may have been added manually
--     (anything INSERT/UPDATE referencing qrcodes but lacking an auth.uid()
--     owner guard is a bug). Scoped to qrcodes only — other buckets untouched.
--     This mirrors the cleanup done for avatars in fix-avatars-upload-policy.sql.
--     If this step is not relevant it simply drops nothing.
-- -----------------------------------------------------------------------------
do $$
declare p text;
begin for p in
select policyname
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE')
    and with_check is not null
    and with_check::text like '%qrcodes%'
    and with_check::text !~* 'auth\.uid' loop execute format(
        'drop policy if exists %I on storage.objects;',
        p
    );
end loop;
end $$;
-- -----------------------------------------------------------------------------
-- 2. (Re)create the owner-scoped policies.
-- -----------------------------------------------------------------------------
-- Public read: anyone can fetch a QR (profiles are public, so QRs must be too).
create policy "qrcodes_public_read" on storage.objects for
select to public using (bucket_id = 'qrcodes');
-- Owner insert: path must be <auth.uid>/...
create policy "qrcodes_owner_insert" on storage.objects for
insert to authenticated with check (
        bucket_id = 'qrcodes'
        and (storage.foldername(name)) [1] = auth.uid()::text
    );
-- Owner update: only their own object, and the new path must still be theirs.
create policy "qrcodes_owner_update" on storage.objects for
update to authenticated using (
        bucket_id = 'qrcodes'
        and (storage.foldername(name)) [1] = auth.uid()::text
    ) with check (
        bucket_id = 'qrcodes'
        and (storage.foldername(name)) [1] = auth.uid()::text
    );
-- Owner delete: only their own object.
create policy "qrcodes_owner_delete" on storage.objects for delete to authenticated using (
    bucket_id = 'qrcodes'
    and (storage.foldername(name)) [1] = auth.uid()::text
);
-- =============================================================================
-- 3. VERIFICATION — sanity check scoped to qrcodes. Should return ZERO rows.
--    (Every INSERT/UPDATE policy on qrcodes must contain an auth.uid() guard.)
-- =============================================================================
select policyname,
    cmd,
    with_check
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE')
    and with_check is not null
    and with_check::text like '%qrcodes%'
    and with_check::text !~* 'auth\.uid';
-- =============================================================================
-- 4. CONFIRM the qrcodes policies that now exist (expect 4 rows: SELECT public,
--    INSERT owner, UPDATE owner, DELETE owner).
-- =============================================================================
select policyname,
    cmd,
    qual as using_expr,
    with_check as with_check_expr
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and (
        (
            qual is not null
            and qual::text like '%qrcodes%'
        )
        or (
            with_check is not null
            and with_check::text like '%qrcodes%'
        )
        or policyname like 'qrcodes_%'
    )
order by policyname;