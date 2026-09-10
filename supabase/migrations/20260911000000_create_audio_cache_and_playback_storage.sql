-- Migration: Create playback_cache and update search_cache tables in Supabase.
--
-- Enables permanent CDN caching of extracted song audio files in your Supabase Storage bucket
-- and 24-hour caching of YouTube search results.

-- ═══ 1. Table: playback_cache ═══════════════════════════════════════════════════
create table if not exists public.playback_cache (
  video_id text primary key,
  title text not null default '',
  artist text not null default '',
  audio_url text not null,
  duration numeric not null default 0,
  file_size integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS on public.playback_cache
alter table public.playback_cache enable row level security;

-- Policies for playback_cache
drop policy if exists "Playback cache is readable by all" on public.playback_cache;
drop policy if exists "Playback cache is manageable" on public.playback_cache;

create policy "Playback cache is readable by all"
  on public.playback_cache
  for select
  to anon, authenticated, service_role
  using (true);

create policy "Playback cache is manageable"
  on public.playback_cache
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

-- ═══ 2. Table: search_cache Policies Update ═════════════════════════════════════
create table if not exists public.search_cache (
  query text primary key,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.search_cache enable row level security;

drop policy if exists "Search cache is readable by all" on public.search_cache;
drop policy if exists "Search cache is manageable by all" on public.search_cache;

create policy "Search cache is readable by all"
  on public.search_cache
  for select
  to anon, authenticated, service_role
  using (true);

create policy "Search cache is manageable by all"
  on public.search_cache
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

-- ═══ 3. Public Table Grants ═════════════════════════════════════════════════════
grant all on public.playback_cache to anon, authenticated, service_role;
grant all on public.search_cache to anon, authenticated, service_role;
