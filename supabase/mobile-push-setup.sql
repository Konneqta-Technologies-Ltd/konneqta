-- Mobile push tokens (Expo Push) — the native app's counterpart to
-- push_subscriptions (which stores Web Push endpoints for browsers).
--
-- One row per app install: the Expo push token is globally unique per
-- device+app, so upserts on token simply refresh the row.
--
-- RLS: participants own their rows — the register route writes through the
-- caller's Bearer-scoped session client (same pattern as generate-qr), so
-- users can only ever touch their own tokens.

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ExponentPushToken[/...] — globally unique per device + app install.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  created_at timestamptz not null default now()
);

create index if not exists mobile_push_tokens_user_idx
  on public.mobile_push_tokens (user_id);

alter table public.mobile_push_tokens enable row level security;

create policy "mobile_push_tokens_all_own"
  on public.mobile_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
