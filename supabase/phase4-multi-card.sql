-- =============================================================================
-- PHASE 4: Multi-Card System
-- =============================================================================
-- WHAT THIS FILE DOES (in safe, staged order):
--   1. Creates the `cards` table (no data loss)
--   2. Adds RLS policies (owner-only writes, public reads)
--   3. Adds security triggers (card limits, slug validation, ownership)
--   4. Adds `active_card_id` to `profiles` (no data loss)
--   5. Migrates existing data: profiles → cards, social_links re-pointed
--   6. Blocks username changes (slug integrity)
--
-- IRREVERSIBLE STEP (commented out at the bottom):
--   7. Drops old card columns from `profiles` — ONLY run after verifying.
--
-- PREREQUISITE: Run supabase/backup-before-phase4.sql FIRST.
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1. CREATE THE `cards` TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.cards (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    slug text not null unique,
    label text not null default '',
    -- owner-facing name ("Tech Card")
    full_name text,
    job_title text,
    company text,
    bio text,
    avatar_url text,
    logo_url text,
    qr_code_url text,
    theme text not null default 'classic',
    banner_url text,
    is_primary boolean not null default false,
    -- card #1 (slug = username)
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
-- Index for fast slug lookups (the public profile page query)
create index if not exists cards_slug_idx on public.cards (slug);
-- Index for listing a user's cards (the switcher)
create index if not exists cards_owner_idx on public.cards (owner_id);
-- CHECK: slug format — lowercase letters, numbers, hyphens. 3-30 chars.
alter table public.cards drop constraint if exists cards_slug_format;
alter table public.cards
add constraint cards_slug_format check (slug ~ '^[a-z0-9-]{3,30}$');
-- CHECK: theme must be a valid preset (same list as profiles)
alter table public.cards drop constraint if exists cards_theme_valid;
alter table public.cards
add constraint cards_theme_valid check (
        theme in (
            'classic',
            'centered',
            'split',
            'minimal',
            'banner-hero'
        )
    );
-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY ON `cards`
-- -----------------------------------------------------------------------------
alter table public.cards enable row level security;
-- Public read: anyone can view any card (profiles are public)
drop policy if exists "cards_public_read" on public.cards;
create policy "cards_public_read" on public.cards for
select to public using (true);
-- Owner-only INSERT
drop policy if exists "cards_owner_insert" on public.cards;
create policy "cards_owner_insert" on public.cards for
insert to authenticated with check (owner_id = auth.uid());
-- Owner-only UPDATE
drop policy if exists "cards_owner_update" on public.cards;
create policy "cards_owner_update" on public.cards for
update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Owner-only DELETE
drop policy if exists "cards_owner_delete" on public.cards;
create policy "cards_owner_delete" on public.cards for delete to authenticated using (owner_id = auth.uid());
-- -----------------------------------------------------------------------------
-- 3. SECURITY TRIGGERS
-- -----------------------------------------------------------------------------
-- 3a. CARD LIMIT: Free = 1 card, Pro = 3 cards, Exempt = unlimited
create or replace function public.enforce_card_limit() returns trigger language plpgsql as $$
declare v_plan text;
v_exempt boolean;
v_current_count integer;
v_max integer;
begin -- Only service_role or the owner can insert (RLS handles this, but
-- this trigger is the REAL limit enforcer).
select plan,
    is_exempt into v_plan,
    v_exempt
from public.profiles
where id = new.owner_id;
if v_exempt then return new;
-- exempt users bypass the limit
end if;
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
drop trigger if exists cards_enforce_limit on public.cards;
create trigger cards_enforce_limit before
insert on public.cards for each row execute function public.enforce_card_limit();
-- 3b. SLUG VALIDATION: format + reserved words + username-prefix rule
create or replace function public.validate_card_slug() returns trigger language plpgsql as $$ begin -- Reserved words that must NEVER be a slug
    if new.slug in (
        'edit',
        'api',
        'auth',
        'onboarding',
        'post-login',
        'admin',
        'konneqta',
        'vcard',
        'signature',
        'share',
        'settings',
        'offline',
        'manifest',
        'sw',
        'banners',
        'icons',
        'favicon.ico',
        '_next',
        'login',
        'signup',
        'forgot-password'
    ) then raise exception 'Slug "%" is reserved',
    new.slug;
end if;
-- For NON-primary cards: slug must start with the owner's username + "-"
-- This prevents impersonation (user A can't create a slug starting
-- with user B's username).
if new.is_primary = false then if not (
    new.slug like (
        (
            select username
            from public.profiles
            where id = new.owner_id
        ) || '-%'
    )
) then raise exception 'Card slug must start with your username followed by a hyphen (e.g. yourname-design)';
end if;
end if;
-- For primary cards: slug MUST equal the owner's username
if new.is_primary = true then if new.slug <> (
    select username
    from public.profiles
    where id = new.owner_id
) then raise exception 'Primary card slug must match your username';
end if;
end if;
return new;
end;
$$;
drop trigger if exists cards_validate_slug on public.cards;
create trigger cards_validate_slug before
insert
    or
update of slug on public.cards for each row execute function public.validate_card_slug();
-- 3c. PROTECT PRIMARY CARD: can't delete or un-primary card #1
create or replace function public.protect_primary_card() returns trigger language plpgsql as $$ begin if tg_op = 'DELETE'
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
drop trigger if exists cards_protect_primary on public.cards;
create trigger cards_protect_primary before delete
or
update of is_primary on public.cards for each row execute function public.protect_primary_card();
-- 3d. ACTIVE_CARD OWNERSHIP: active_card_id must point to a card you own
create or replace function public.validate_active_card() returns trigger language plpgsql as $$ begin if new.active_card_id is not null then if not exists (
        select 1
        from public.cards
        where id = new.active_card_id
            and owner_id = new.id
    ) then raise exception 'active_card_id must point to a card you own';
end if;
end if;
return new;
end;
$$;
-- -----------------------------------------------------------------------------
-- 4. ADD `active_card_id` TO PROFILES
-- -----------------------------------------------------------------------------
alter table public.profiles
add column if not exists active_card_id uuid;
-- Drop + recreate the active_card ownership trigger (needs the column to exist)
drop trigger if exists profiles_validate_active_card on public.profiles;
create trigger profiles_validate_active_card before
insert
    or
update of active_card_id on public.profiles for each row execute function public.validate_active_card();
-- Add FK (after the trigger so the trigger can validate first)
-- We use DEFERRABLE so the trigger + FK don't deadlock during migration
do $$ begin if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'profiles_active_card_fk'
) then
alter table public.profiles
add constraint profiles_active_card_fk foreign key (active_card_id) references public.cards(id) on delete
set null deferrable initially deferred;
end if;
end $$;
-- -----------------------------------------------------------------------------
-- 5. DATA MIGRATION: copy existing profiles → cards
-- -----------------------------------------------------------------------------
-- Every existing user gets ONE card (their primary) with their current data.
-- This is the safe step — the original columns stay until step 7.
insert into public.cards (
        owner_id,
        slug,
        label,
        full_name,
        job_title,
        company,
        bio,
        avatar_url,
        logo_url,
        qr_code_url,
        theme,
        banner_url,
        is_primary,
        sort_order
    )
select p.id,
    p.username,
    'Primary',
    p.full_name,
    p.job_title,
    p.company,
    p.bio,
    p.avatar_url,
    p.logo_url,
    p.qr_code_url,
    coalesce(p.theme, 'classic'),
    p.banner_url,
    true,
    0
from public.profiles p
where not exists (
        select 1
        from public.cards c
        where c.owner_id = p.id
            and c.is_primary = true
    );
-- Repoint social_links: add card_id column, copy data, keep profile_id for now
do $$ begin if not exists (
    select 1
    from information_schema.columns
    where table_name = 'social_links'
        and column_name = 'card_id'
) then
alter table public.social_links
add column card_id uuid;
end if;
end $$;
-- Backfill: map each social_link to the owner's primary card
update public.social_links sl
set card_id = c.id
from public.cards c
where c.owner_id = sl.profile_id
    and c.is_primary = true
    and sl.card_id is null;
-- Add FK on card_id (deferred)
do $$ begin if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'social_links_card_fk'
) then
alter table public.social_links
add constraint social_links_card_fk foreign key (card_id) references public.cards(id) on delete cascade deferrable initially deferred;
end if;
end $$;
-- Set active_card_id to the primary card for every user
update public.profiles p
set active_card_id = c.id
from public.cards c
where c.owner_id = p.id
    and c.is_primary = true
    and p.active_card_id is null;
-- -----------------------------------------------------------------------------
-- 6. BLOCK USERNAME CHANGES (slug integrity)
-- -----------------------------------------------------------------------------
-- Since card #1's slug = username, changing username would break the URL.
-- This trigger prevents it. (The edit form will also hide the username field
-- for users who have cards.)
create or replace function public.block_username_change() returns trigger language plpgsql as $$ begin if new.username is distinct
from old.username then raise exception 'Username cannot be changed once cards exist. Contact support.';
end if;
return new;
end;
$$;
drop trigger if exists profiles_lock_username on public.profiles;
create trigger profiles_lock_username before
update of username on public.profiles for each row
    when (
        new.username is distinct
        from old.username
    ) execute function public.block_username_change();
-- -----------------------------------------------------------------------------
-- 7. UPDATE social_links RLS + policies for card_id
-- -----------------------------------------------------------------------------
-- The existing social_links policies use profile_id = auth.uid(). We need
-- to also allow writes where card_id belongs to the user. Update the policies.
drop policy if exists "social_links_owner_insert" on public.social_links;
create policy "social_links_owner_insert" on public.social_links for
insert to authenticated with check (
        profile_id = auth.uid()
        or card_id in (
            select id
            from public.cards
            where owner_id = auth.uid()
        )
    );
drop policy if exists "social_links_owner_update" on public.social_links;
create policy "social_links_owner_update" on public.social_links for
update to authenticated using (
        profile_id = auth.uid()
        or card_id in (
            select id
            from public.cards
            where owner_id = auth.uid()
        )
    ) with check (
        profile_id = auth.uid()
        or card_id in (
            select id
            from public.cards
            where owner_id = auth.uid()
        )
    );
drop policy if exists "social_links_owner_delete" on public.social_links;
create policy "social_links_owner_delete" on public.social_links for delete to authenticated using (
    profile_id = auth.uid()
    or card_id in (
        select id
        from public.cards
        where owner_id = auth.uid()
    )
);
-- =============================================================================
-- VERIFICATION QUERIES (run these to confirm the migration worked)
-- =============================================================================
-- Every profile should have exactly one primary card:
--   select p.username, c.slug, c.is_primary
--   from profiles p left join cards c on c.owner_id = p.id
--   where c.is_primary = true;
-- Card count per user:
--   select owner_id, count(*) from cards group by owner_id;
-- social_links should have card_id populated:
--   select count(*) filter (where card_id is not null) as with_card,
--          count(*) filter (where card_id is null) as without_card
--   from social_links;
-- =============================================================================
-- STEP 7 (IRREVERSIBLE — RUN ONLY AFTER VERIFYING THE APP WORKS)
-- =============================================================================
-- Once you've confirmed the app reads from `cards` correctly, uncomment and
-- run this to drop the now-redundant columns from `profiles`. This frees up
-- space and enforces the single-source-of-truth model.
--
-- -- Drop card data columns from profiles (now in cards table):
-- alter table public.profiles drop column if exists job_title;
-- alter table public.profiles drop column if exists company;
-- alter table public.profiles drop column if exists bio;
-- alter table public.profiles drop column if exists avatar_url;
-- alter table public.profiles drop column if exists logo_url;
-- alter table public.profiles drop column if exists qr_code_url;
-- alter table public.profiles drop column if exists theme;
-- alter table public.profiles drop column if exists banner_url;
--
-- -- Drop profile_id from social_links (replaced by card_id):
-- alter table public.social_links drop column if exists profile_id;
-- =============================================================================