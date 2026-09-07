-- Migration: Create search_cache table for server-side caching of YouTube search results.
--
-- Caches search results for 24 hours to reduce YouTube Data API quota usage.
-- Query is stored normalized (lowercased and trimmed).
-- Table has RLS enabled with policies and full GRANTs for service_role, authenticated, and anon.

create table if not exists public.search_cache (
  query text primary key,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.search_cache enable row level security;

-- Policies
create policy "Search cache is readable by all"
  on public.search_cache
  for select
  to anon, authenticated, service_role
  using (true);

create policy "Search cache is manageable by service_role"
  on public.search_cache
  for all
  to service_role
  using (true)
  with check (true);

-- Table-level grants for service_role, authenticated, and anon
grant select on public.search_cache to anon;
grant select on public.search_cache to authenticated;
grant all on public.search_cache to service_role;
