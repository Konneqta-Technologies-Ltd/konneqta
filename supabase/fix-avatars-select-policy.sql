-- =============================================================================
-- FIX: avatars SELECT policy allows full bucket enumeration
-- =============================================================================
-- CONTEXT
-- -------
-- After fixing the INSERT vulnerability (fix-avatars-upload-policy.sql), the
-- full inspect-storage-policies.sql output showed every bucket is now
-- owner-scoped for INSERT/UPDATE/DELETE. EXCEPT one outlier on SELECT:
--
--   avatars | "Allow public read access to specific avatars only"
--           | using: (bucket_id = 'avatars') AND (storage.foldername(name))[1] IS NOT NULL
--
-- The policy NAME sounds restrictive ("specific avatars only"), but the actual
-- expression is satisfied by ANY file that lives inside a folder — which is
-- effectively every avatar. So an anonymous caller can still do:
--
--   supabase.storage.from('avatars').list()
--
-- and enumerate every user's folder name (= their user id) and avatar file.
-- That is the same metadata-enumeration leak fix-bucket-listing.sql removed
-- for the other public buckets.
--
-- Compare to logos, which is locked down correctly:
--
--   logos | "Users can list own logos"
--         | using: (bucket_id = 'logos') AND (storage.foldername(name))[1] = auth.uid()::text
--
-- THE FIX
-- -------
-- Replace the broad avatars SELECT with an owner-scoped one that matches the
-- logos pattern. Public URL reads still work (the bucket's `public` flag
-- serves those, not RLS); only `.list()` is gated, and now to the owner.
--
-- Safe to re-run.
-- =============================================================================
-- 1. Drop the overly-broad avatars SELECT policy.
drop policy if exists "Allow public read access to specific avatars only" on storage.objects;
-- 2. Recreate it owner-scoped, mirroring "Users can list own logos".
create policy "Users can list own avatars" on storage.objects for
select to authenticated using (
        bucket_id = 'avatars'
        and (storage.foldername(name)) [1] = (auth.uid())::text
    );
-- =============================================================================
-- 3. VERIFICATION — every SELECT policy on storage.objects should now be
--    owner-scoped. This returns any SELECT policy whose USING lacks auth.uid().
--    Expected: zero rows.
-- =============================================================================
select policyname,
    cmd,
    qual as using_expr
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'
    and (
        qual is null
        or qual !~* 'auth\.uid'
    );