-- Migration: Create trending_cache table for server-side caching of trending music tracks.
--
-- Stores pre-aggregated YouTube search results for broad trending queries.
-- Publicly readable by anon and authenticated roles.
-- Writes are handled exclusively by the server via Supabase Service Role.

create table if not exists public.trending_cache (
  id uuid default gen_random_uuid() primary key,
  query text not null unique,
  results jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

-- Enable RLS
alter table public.trending_cache enable row level security;

-- Policies: Public read access
create policy "Trending cache is publicly readable by anon and authenticated"
  on public.trending_cache
  for select
  to anon, authenticated
  using (true);

-- Table-level grants
grant select on public.trending_cache to anon;
grant select on public.trending_cache to authenticated;
