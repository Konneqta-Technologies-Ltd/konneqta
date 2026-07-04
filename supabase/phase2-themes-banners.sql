-- =============================================================================
-- PHASE 2: Themes + Banners (Pro features)
-- =============================================================================
-- WHAT THIS FILE DOES
-- --------------------
-- 1. Adds `theme` column to `profiles` — stores the preset id (a short
--    string like 'classic', 'centered'). NEVER raw CSS/HTML — XSS-proof.
-- 2. Adds `banner_url` column — the virtual background image URL behind
--    the avatar on the card front.
-- 3. Adds a CHECK constraint that locks `theme` to the valid preset ids.
--
-- SECURITY MODEL
-- --------------
-- Unlike `plan`/`is_exempt` (which are service-role-only via the trigger in
-- entitlements-setup.sql), `theme` and `banner_url` MUST be owner-writable
-- — the user picks their own theme/banner. This is safe because:
--
--   - `theme` is constrained by CHECK to ONLY the preset ids below. A user
--     cannot inject 'javascript:...' or raw CSS — the DB rejects anything
--     not in the allowlist. There is zero XSS surface.
--   - `banner_url` is validated client-side (must point to the user's own
--     Supabase storage path) before write, and is sanitized at render time
--     via isAllowedStorageUrl() — same SSRF guard used for avatar OG images.
--
-- So the anti-backdoor trigger does NOT touch these columns. The existing
-- RLS (owner can update their own row) handles authorization.
--
-- HOW TO RUN
-- ----------
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Safe to re-run (idempotent).
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. `theme` column — the preset id
-- -----------------------------------------------------------------------------
alter table public.profiles
add column if not exists theme text not null default 'classic';
-- CHECK constraint: theme must be one of the valid preset ids.
-- To add a new preset later: add its id to this list AND to lib/themes.ts.
alter table public.profiles drop constraint if exists profiles_theme_valid;
alter table public.profiles
add constraint profiles_theme_valid check (
        theme in (
            'classic',
            'centered',
            'split',
            'minimal',
            'banner-hero'
        )
    );
-- -----------------------------------------------------------------------------
-- 2. `banner_url` column — the virtual background image
-- -----------------------------------------------------------------------------
alter table public.profiles
add column if not exists banner_url text;
-- -----------------------------------------------------------------------------
-- 3. VERIFICATION QUERIES (run after to confirm)
-- -----------------------------------------------------------------------------
-- Confirm the columns exist:
--   select username, theme, banner_url from profiles limit 10;
-- =============================================================================
-- STORAGE BUCKET SETUP (DO THIS IN THE DASHBOARD — not SQL)
-- =============================================================================
-- Create a new public bucket named `banners`:
--   Dashboard → Storage → New bucket
--   Name: banners
--   Public: yes
--   Allowed MIME types: image/jpeg, image/png, image/webp
--   Max file size: 5 MB
--
-- NO SVG — same stored-XSS rule as avatars/logos.
-- =============================================================================