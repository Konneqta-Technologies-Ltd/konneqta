-- =============================================================================
-- Diagnostic: inspect storage policies (qual vs with_check)
-- =============================================================================
-- WHY THIS EXISTS
-- ---------------
-- If you query pg_policies and only look at `qual`, every INSERT policy shows
-- NULL. That looks scary — like the policy is missing its restriction.
--
-- It is NOT missing. PostgreSQL stores policy expressions in TWO columns:
--
--   qual        → the USING (...) clause
--                 Filters EXISTING rows. Applies to SELECT, UPDATE, DELETE.
--                 Always NULL for INSERT (there are no existing rows to filter
--                 on an insert).
--
--   with_check  → the WITH CHECK (...) clause
--                 Validates the NEW row after the write. Applies to INSERT and
--                 UPDATE. This is where INSERT restrictions actually live.
--
-- So for an INSERT policy, the real guard is in `with_check`, not `qual`.
-- Run the query below to see BOTH columns side by side.
-- =============================================================================
-- Full picture: policy name, command, USING (qual), and WITH CHECK.
select policyname,
    cmd,
    -- SELECT | INSERT | UPDATE | DELETE
    qual as using_expr,
    -- WHERE-style filter on existing rows
    with_check as with_check_expr -- validation on the new row (INSERT guard)
from pg_policies
where schemaname = 'storage'
    and tablename = 'objects'
order by policyname;
-- =============================================================================
-- QUICK SANITY CHECK: "are all my INSERT policies actually owner-scoped?"
-- This returns any INSERT/UPDATE policy whose WITH CHECK is empty or missing
-- the auth.uid() owner guard. If it returns zero rows, you're locked down.
-- =============================================================================
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
-- EXPECTED RESULT for the Konneqta buckets
-- (avatars, logos, banners, qrcodes)
-- =============================================================================
-- SELECT  policies → qual is non-null (folder / public-read filter)
-- INSERT  policies → qual IS NULL, with_check is non-null (owner folder check)
-- UPDATE  policies → BOTH qual and with_check are non-null
-- DELETE  policies → qual is non-null (with_check is null — DELETE has no new row)
--
-- The `null` you saw on INSERT qual is correct. The guard is in with_check.
-- =============================================================================