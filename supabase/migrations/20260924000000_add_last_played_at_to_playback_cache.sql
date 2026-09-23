-- Migration: Add last_played_at to playback_cache and index it for efficient TTL & LRU queries.
--
-- Enables 7-day TTL eviction and LRU capacity cap sweeps to maintain Supabase storage usage under 1 GB.

-- 1. Add last_played_at column if not exists
alter table public.playback_cache 
  add column if not exists last_played_at timestamptz default now();

-- 2. Backfill existing rows so last_played_at defaults to created_at if null
update public.playback_cache 
  set last_played_at = created_at 
  where last_played_at is null;

-- 3. Create index for fast time-based cleanup queries
create index if not exists idx_playback_cache_last_played 
  on public.playback_cache (last_played_at);
