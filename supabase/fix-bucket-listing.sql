-- =============================================================================
-- FIX: "Clients can list all files in this bucket"
-- =============================================================================
-- THE PROBLEM
-- -----------
-- Supabase shows this warning on public buckets (avatars, logos, qrcodes,
-- banners) when there's a broad SELECT policy on `storage.objects`:
--
--   "A broad SELECT policy on storage.objects allows clients to retrieve a
--    full list of files."
--
-- What this means: anyone can call `supabase.storage.from('avatars').list()`
-- and enumerate EVERY uploaded file name in the bucket. The actual image
-- bytes are public anyway (that's fine), but the FILE LIST should not be
-- enumerable — it leaks metadata (how many users, their user IDs which are
-- the folder names, etc.).
--
-- THE FIX
-- -------
-- Public buckets DON'T need a SELECT policy on storage.objects. The bucket's
-- `public` flag already serves files by URL. Dropping the SELECT policy
-- stops enumeration while keeping public URLs working.
--
-- Run this once for ALL public buckets. Safe to re-run.
-- =============================================================================
-- Drop the broad SELECT policies that allow file enumeration.
-- These policy NAMES are the common defaults; if yours differ, run:
--   select policyname, tablename from pg_policies where schemaname = 'storage';
-- to find the exact names, then drop those.
-- Avatars bucket
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "Avatars public read" on storage.objects;
-- Logos bucket
drop policy if exists "logos_public_read" on storage.objects;
drop policy if exists "Logos public read" on storage.objects;
-- QR codes bucket
drop policy if exists "qrcodes_public_read" on storage.objects;
drop policy if exists "Qrcodes public read" on storage.objects;
-- Banners bucket (new — Phase 2)
drop policy if exists "banners_public_read" on storage.objects;
drop policy if exists "Banners public read" on storage.objects;
-- =============================================================================
-- WHY PUBLIC URLS STILL WORK AFTER DROPPING THESE
-- =============================================================================
-- A "public" bucket in Supabase serves files by direct URL without any RLS
-- check. The URL pattern is:
--   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
--
-- That path works because of the bucket's `public = true` flag, NOT because
-- of a SELECT policy. The SELECT policy only governs the `.list()` API,
-- which is what we want to block.
--
-- After running this, verify:
--   1. Visit a known avatar URL in your browser → still loads ✅
--   2. Run `supabase.storage.from('avatars').list()` in the JS client
--      → should return empty/error (no more enumeration) ✅
-- =============================================================================