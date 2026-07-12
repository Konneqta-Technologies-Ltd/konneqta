-- =============================================================================
-- FIX: overly-permissive avatar upload policy
-- =============================================================================
-- THE VULNERABILITY
-- -----------------
-- The avatars bucket has TWO INSERT policies. RLS ORs same-command policies
-- together, so the WEAKEST one wins. The policy:
--
--   "Authenticated users can upload avatars"
--     WITH CHECK (bucket_id = 'avatars'::text)
--
-- only checks that the upload lands in the avatars bucket. It does NOT verify
-- the path belongs to the authenticated user. Any logged-in user could upload
-- to ANY path, including overwriting other users' avatars:
--
--   <victim_user_id>/avatar.png
--
-- This is the row the sanity-check query in inspect-storage-policies.sql
-- flagged:
--
--   policyname | Authenticated users can upload avatars
--   cmd        | INSERT
--   with_check | (bucket_id = 'avatars'::text)   ← missing auth.uid() guard
--
-- THE FIX
-- -------
-- Drop the redundant broad policy. The owner-scoped policy
-- "Allow users to upload avatars to their own folder" already handles
-- legitimate uploads with the correct WITH CHECK:
--
--   bucket_id = 'avatars' and storage.foldername(name)[1] = auth.uid()::text
--
-- After dropping the broad one, the OR-collapse problem disappears and the
-- owner-scoped check becomes the only gate.
--
-- Safe to re-run (DROP IF EXISTS is a no-op after the first run).
-- =============================================================================
-- 1. Drop the overly-permissive INSERT policy on avatars.
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
-- =============================================================================
-- 2. VERIFICATION — re-run the sanity check. It should now return ZERO rows.
-- =============================================================================
-- If it returns anything, that bucket's INSERT/UPDATE is still unguarded.
select policyname,
    cmd,
    with_check
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE')
    and (
        with_check is null
        or with_check !~* 'auth\.uid'
    );
-- =============================================================================
-- 3. CONFIRM the avatars INSERT policies that remain.
--    You should see ONLY "Allow users to upload avatars to their own folder"
--    with a WITH CHECK containing auth.uid().
-- =============================================================================
select policyname,
    cmd,
    with_check
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'INSERT'
    and with_check::text like '%avatars%'
order by policyname;