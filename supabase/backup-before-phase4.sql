-- =============================================================================
-- BACKUP: Run this BEFORE Phase 4 to snapshot your current data.
-- =============================================================================
-- This creates backup TABLES (not CSV exports) in your database. They're
-- exact copies of profiles + social_links at this moment. If Phase 4 goes
-- wrong, you can SELECT from these to restore.
--
-- Run this in the Supabase SQL Editor, then verify with:
--   select count(*) from backup_profiles;
--   select count(*) from backup_social_links;
-- =============================================================================
-- Drop old backups if re-running
drop table if exists backup_social_links;
drop table if exists backup_profiles;
-- Exact copies of current data (structure + data)
create table backup_profiles as
select *
from profiles;
create table backup_social_links as
select *
from social_links;
-- Quick verify — these should show your real row counts:
select 'profiles backup rows: ' || count(*) as info
from backup_profiles;
select 'social_links backup rows: ' || count(*) as info
from backup_social_links;