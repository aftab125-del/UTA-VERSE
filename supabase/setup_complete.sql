
-- ==========================================================================
-- MIGRATION: 20260821000000_music_catalog_foundation.sql
-- ==========================================================================
create extension if not exists pgcrypto;

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_id uuid not null references public.artists(id) on delete restrict,
  artwork_url text,
  release_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_id uuid not null references public.artists(id) on delete restrict,
  album_id uuid references public.albums(id) on delete set null,
  artwork_url text,
  audio_url text,
  duration integer not null check (duration >= 0),
  track_number integer check (track_number is null or track_number > 0),
  created_at timestamptz not null default now()
);

-- Playlists are user-owned because the existing product contract treats them as account data.
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (playlist_id, track_id),
  unique (playlist_id, position)
);

create index if not exists albums_artist_id_idx on public.albums(artist_id);
create index if not exists tracks_artist_id_idx on public.tracks(artist_id);
create index if not exists tracks_album_id_idx on public.tracks(album_id);
create index if not exists playlists_user_id_idx on public.playlists(user_id);
create index if not exists playlist_tracks_track_id_idx on public.playlist_tracks(track_id);

alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

create policy "Public catalog is readable"
  on public.artists for select using (true);
create policy "Public albums are readable"
  on public.albums for select using (true);
create policy "Public tracks are readable"
  on public.tracks for select using (true);
create policy "Users can read their playlists"
  on public.playlists for select using (auth.uid() = user_id);
create policy "Users can manage their playlists"
  on public.playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage tracks in their playlists"
  on public.playlist_tracks for all
  using (exists (select 1 from public.playlists where playlists.id = playlist_tracks.playlist_id and playlists.user_id = auth.uid()))
  with check (exists (select 1 from public.playlists where playlists.id = playlist_tracks.playlist_id and playlists.user_id = auth.uid()));


-- ==========================================================================
-- MIGRATION: 20260822000000_profiles_and_auth.sql
-- ==========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public read: any visitor (authenticated or anonymous) can see display names and
-- avatars across the app — this is simpler than per-user visibility and matches the
-- expected product behaviour (usernames are not private).
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

-- Owner write: only the profile owner can update their own row.
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Owner insert: the owner can also insert their own profile row (used by the
-- on-signup trigger, which runs with definer rights, but this covers edge cases
-- where client code might insert directly).
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Automatically create a profiles row when a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ==========================================================================
-- MIGRATION: 20260823000000_library_favorites_history.sql
-- ==========================================================================
-- ─── Liked tracks ────────────────────────────────────────────────────────────
-- One row per user+track. Toggling a like inserts or deletes the row.
create table if not exists public.liked_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists liked_tracks_user_id_idx on public.liked_tracks(user_id);
create index if not exists liked_tracks_track_id_idx on public.liked_tracks(track_id);

alter table public.liked_tracks enable row level security;

create policy "Users can read their own liked tracks"
  on public.liked_tracks for select using (auth.uid() = user_id);
create policy "Users can like tracks"
  on public.liked_tracks for insert with check (auth.uid() = user_id);
create policy "Users can unlike tracks"
  on public.liked_tracks for delete using (auth.uid() = user_id);

-- ─── Listening history ───────────────────────────────────────────────────────
-- Append-only log of every track the user plays.
create table if not exists public.listening_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  played_at timestamptz not null default now(),
  progress_ms integer not null default 0 check (progress_ms >= 0)
);

create index if not exists listening_history_user_id_idx on public.listening_history(user_id);
create index if not exists listening_history_user_id_played_at_idx on public.listening_history(user_id, played_at desc);

alter table public.listening_history enable row level security;

create policy "Users can read their own listening history"
  on public.listening_history for select using (auth.uid() = user_id);
create policy "Users can insert listening history"
  on public.listening_history for insert with check (auth.uid() = user_id);
create policy "Users can delete their own listening history"
  on public.listening_history for delete using (auth.uid() = user_id);

-- ─── Playlist folders ────────────────────────────────────────────────────────
create table if not exists public.playlist_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists playlist_folders_user_id_idx on public.playlist_folders(user_id);

alter table public.playlist_folders enable row level security;

create policy "Users can read their own folders"
  on public.playlist_folders for select using (auth.uid() = user_id);
create policy "Users can create folders"
  on public.playlist_folders for insert with check (auth.uid() = user_id);
create policy "Users can update their own folders"
  on public.playlist_folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own folders"
  on public.playlist_folders for delete using (auth.uid() = user_id);

-- ─── Extend playlists table ──────────────────────────────────────────────────
-- Add folder and visibility columns to the existing playlists table.
alter table public.playlists
  add column if not exists folder_id uuid references public.playlist_folders(id) on delete set null,
  add column if not exists is_public boolean not null default false;

create index if not exists playlists_folder_id_idx on public.playlists(folder_id);


-- ==========================================================================
-- MIGRATION: 20260823000001_fix_rls_policies.sql
-- ==========================================================================
-- Recreate RLS policies to ensure they are correctly applied.
-- Drop existing policies first to avoid conflicts.

-- liked_tracks
drop policy if exists "Users can read their own liked tracks" on public.liked_tracks;
drop policy if exists "Users can like tracks" on public.liked_tracks;
drop policy if exists "Users can unlike tracks" on public.liked_tracks;

create policy "Users can read their own liked tracks"
  on public.liked_tracks for select
  using (auth.uid()::text = user_id::text);

create policy "Users can like tracks"
  on public.liked_tracks for insert
  with check (auth.uid()::text = user_id::text);

create policy "Users can unlike tracks"
  on public.liked_tracks for delete
  using (auth.uid()::text = user_id::text);

-- listening_history
drop policy if exists "Users can read their own listening history" on public.listening_history;
drop policy if exists "Users can insert listening history" on public.listening_history;
drop policy if exists "Users can delete their own listening history" on public.listening_history;

create policy "Users can read their own listening history"
  on public.listening_history for select
  using (auth.uid()::text = user_id::text);

create policy "Users can insert listening history"
  on public.listening_history for insert
  with check (auth.uid()::text = user_id::text);

create policy "Users can delete their own listening history"
  on public.listening_history for delete
  using (auth.uid()::text = user_id::text);

-- playlists
drop policy if exists "Users can read their playlists" on public.playlists;
drop policy if exists "Users can manage their playlists" on public.playlists;

create policy "Users can read their playlists"
  on public.playlists for select
  using (auth.uid()::text = user_id::text);

create policy "Users can manage their playlists"
  on public.playlists for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

-- playlist_tracks (owner access via playlist ownership)
drop policy if exists "Users can manage tracks in their playlists" on public.playlist_tracks;

create policy "Users can manage tracks in their playlists"
  on public.playlist_tracks for all
  using (exists (
    select 1 from public.playlists
    where playlists.id = playlist_tracks.playlist_id
      and playlists.user_id::text = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.playlists
    where playlists.id = playlist_tracks.playlist_id
      and playlists.user_id::text = auth.uid()::text
  ));


-- ==========================================================================
-- MIGRATION: 20260823000002_nuclear_rls_fix.sql
-- ==========================================================================
-- Nuclear option: drop ALL policies on affected tables and recreate with explicit role.
-- This ensures no stale or conflicting policies remain.

-- ═══ liked_tracks ═══
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read their own liked tracks" ON public.liked_tracks;
  DROP POLICY IF EXISTS "Users can like tracks" ON public.liked_tracks;
  DROP POLICY IF EXISTS "Users can unlike tracks" ON public.liked_tracks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY liked_tracks_select ON public.liked_tracks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY liked_tracks_insert ON public.liked_tracks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY liked_tracks_delete ON public.liked_tracks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══ listening_history ═══
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read their own listening history" ON public.listening_history;
  DROP POLICY IF EXISTS "Users can insert listening history" ON public.listening_history;
  DROP POLICY IF EXISTS "Users can delete their own listening history" ON public.listening_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY listening_history_select ON public.listening_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY listening_history_insert ON public.listening_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY listening_history_delete ON public.listening_history
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══ playlists ═══
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read their playlists" ON public.playlists;
  DROP POLICY IF EXISTS "Users can manage their playlists" ON public.playlists;
  DROP POLICY IF EXISTS "Users can read their playlists" ON public.playlists;
  DROP POLICY IF EXISTS "Users can manage their playlists" ON public.playlists;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY playlists_select ON public.playlists
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY playlists_insert ON public.playlists
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY playlists_update ON public.playlists
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY playlists_delete ON public.playlists
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══ playlist_tracks ═══
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage tracks in their playlists" ON public.playlist_tracks;
  DROP POLICY IF EXISTS "Users can manage tracks in their playlists" ON public.playlist_tracks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY playlist_tracks_all ON public.playlist_tracks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ));


-- ==========================================================================
-- MIGRATION: 20260905000000_fix_track_id_type_to_text.sql
-- ==========================================================================
-- Migration: Convert track_id from uuid to text on all user-data tables.
--
-- Root cause: All tracks now originate from YouTube search (catalog removed).
-- Track IDs are strings like "youtube:2C_ZKkixuow" — never valid UUIDs.
-- Every insert/query against a uuid track_id column fails with
-- "invalid input syntax for type uuid", which PostgREST can surface as 403
-- permission-denied when the type cast fails during query planning before
-- RLS evaluation completes.
--
-- Strategy: Drop the FK constraints to the deprecated tracks catalog table
-- first (a uuid FK cannot coexist with a text column), then alter the columns.
-- We do NOT recreate the FKs because the tracks table is deprecated and no
-- catalog tracks will be added going forward.

-- ═══ 1. Drop foreign key constraints on track_id ═════════════════════════════

-- liked_tracks.track_id -> tracks(id)
DO $$ BEGIN
  ALTER TABLE public.liked_tracks
    DROP CONSTRAINT IF EXISTS liked_tracks_track_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- listening_history.track_id -> tracks(id)
DO $$ BEGIN
  ALTER TABLE public.listening_history
    DROP CONSTRAINT IF EXISTS listening_history_track_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- playlist_tracks.track_id -> tracks(id)
DO $$ BEGIN
  ALTER TABLE public.playlist_tracks
    DROP CONSTRAINT IF EXISTS playlist_tracks_track_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══ 2. Alter track_id from uuid to text ══════════════════════════════════════

ALTER TABLE public.liked_tracks
  ALTER COLUMN track_id TYPE text;

ALTER TABLE public.listening_history
  ALTER COLUMN track_id TYPE text;

ALTER TABLE public.playlist_tracks
  ALTER COLUMN track_id TYPE text;

-- ═══ 3. Verify RLS policies still function ═══════════════════════════════════
-- The existing RLS policies on these three tables reference only user_id
-- (compared to auth.uid()), NOT track_id. Changing track_id's type has no
-- effect on policy evaluation. The policies from the nuclear fix migration
-- remain correct:
--
--   liked_tracks:     user_id = auth.uid()  (uuid = uuid ✓)
--   listening_history: user_id = auth.uid()  (uuid = uuid ✓)
--   playlist_tracks:   EXISTS subquery on playlists.user_id = auth.uid()  (uuid = uuid ✓)
--
-- No policy changes are required.


-- ==========================================================================
-- MIGRATION: 20260905000001_grant_table_privileges.sql
-- ==========================================================================
-- Migration: Grant table-level privileges to authenticated (and anon) roles.
--
-- Root cause: All 6 prior migrations created tables and RLS policies but never
-- issued GRANT statements. In Postgres, RLS policies control WHICH rows a role
-- can see; a GRANT controls WHETHER the role can access the table at all —
-- these are independent layers. Without a GRANT, even a matching RLS policy
-- cannot help: Postgres rejects the query before RLS evaluation with
-- "permission denied for table <name>" (exact error text).
--
-- The Supabase dashboard auto-grants when tables are created through its UI,
-- but hand-written SQL migrations do not do this implicitly.
--
-- This migration:
-- 1. Ensures the authenticated role has USAGE on the public schema
-- 2. Grants USAGE, SELECT on all sequences (needed for gen_random_uuid() defaults)
-- 3. Grants the exact DML privileges each table needs based on actual app code

-- ═══ 1. Schema and sequence grants ════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ═══ 2. Catalog tables (read-only for everyone) ══════════════════════════════
-- artists, albums, tracks: SELECT only for both anon and authenticated.
-- These are public catalog data; no user writes to them.

GRANT SELECT ON public.artists TO authenticated;
GRANT SELECT ON public.artists TO anon;

GRANT SELECT ON public.albums TO authenticated;
GRANT SELECT ON public.albums TO anon;

GRANT SELECT ON public.tracks TO authenticated;
GRANT SELECT ON public.tracks TO anon;

-- ═══ 3. Profiles (public read, owner write) ═══════════════════════════════════
-- anon + authenticated can read; only authenticated can insert/update (owner
-- enforced by RLS). The handle_new_user() trigger runs as security definer so
-- it bypasses RLS, but direct client inserts need the GRANT.

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- ═══ 4. User-data tables (authenticated only) ═════════════════════════════════

-- liked_tracks: SELECT, INSERT, DELETE (toggle pattern, no UPDATE)
GRANT SELECT, INSERT, DELETE ON public.liked_tracks TO authenticated;

-- listening_history: SELECT, INSERT, DELETE (append-only + cleanup, no UPDATE)
GRANT SELECT, INSERT, DELETE ON public.listening_history TO authenticated;

-- playlists: full CRUD (create, read, edit name/description, delete)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;

-- playlist_tracks: SELECT, INSERT, DELETE (add/remove/reorder, no UPDATE used)
GRANT SELECT, INSERT, DELETE ON public.playlist_tracks TO authenticated;

-- playlist_folders: full CRUD (create, read, rename/reorder, delete)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_folders TO authenticated;


-- ==========================================================================
-- MIGRATION: 20260905000002_add_track_metadata_columns.sql
-- ==========================================================================
-- Migration: Add denormalized track metadata columns to user-data tables.
--
-- Root cause: After removing the catalog, liked_tracks/listening_history/
-- playlist_tracks still tried to hydrate track details by querying the
-- deprecated "tracks" table (uuid PK). YouTube track IDs (text, e.g.
-- "youtube:9Jybsz-7TFM") never match catalog UUIDs, so every lookup failed
-- with "invalid input syntax for type uuid".
--
-- Fix: Store title, artist, artwork, and duration directly in the junction
-- tables at write time. All three tables use snake_case column naming
-- consistent with the existing schema (e.g. user_id, track_id, created_at,
-- progress_ms, is_public).

-- ═══ liked_tracks ═════════════════════════════════════════════════════════════

alter table public.liked_tracks
  add column if not exists title text not null default '',
  add column if not exists artist text not null default '',
  add column if not exists artwork text not null default '',
  add column if not exists duration integer not null default 0;

-- ═══ listening_history ═════════════════════════════════════════════════════════

alter table public.listening_history
  add column if not exists title text not null default '',
  add column if not exists artist text not null default '',
  add column if not exists artwork text not null default '',
  add column if not exists duration integer not null default 0;

-- ═══ playlist_tracks ══════════════════════════════════════════════════════════

alter table public.playlist_tracks
  add column if not exists title text not null default '',
  add column if not exists artist text not null default '',
  add column if not exists artwork text not null default '',
  add column if not exists duration integer not null default 0;


-- ==========================================================================
-- MIGRATION: 20260905000003_fix_playlist_tracks_rls_and_grants.sql
-- ==========================================================================
-- Migration: Fix playlist_tracks RLS policies and GRANTs.
--
-- Evidence:
--   1. The GRANT in 20260905000001_grant_table_privileges.sql line 58-59 grants
--      SELECT, INSERT, DELETE on playlist_tracks — but NOT UPDATE.
--      Postgres evaluates GRANTs before RLS, so any .update() call fails with
--      "permission denied for table playlist_tracks" regardless of RLS policies.
--
--   2. The only RLS policy on playlist_tracks is a single FOR ALL policy
--      ("playlist_tracks_all" from 20260823000002_nuclear_rls_fix.sql).
--      While a FOR ALL policy should in theory cover all operations, splitting
--      into explicit per-operation policies:
--        a) matches the pattern used on liked_tracks and listening_history,
--        b) makes the dashboard show one policy per operation (consistent UX),
--        c) eliminates any ambiguity about which operation each clause covers.
--
-- This migration:
--   1. Drops the existing FOR ALL policy on playlist_tracks.
--   2. Creates separate SELECT, INSERT, UPDATE, DELETE policies using the
--      ownership-via-join pattern (playlists.user_id = auth.uid()).
--   3. Grants UPDATE on playlist_tracks to authenticated (was missing).

-- ═══ 1. Drop the existing FOR ALL policy ═════════════════════════════════════

DO $$ BEGIN
  DROP POLICY IF EXISTS playlist_tracks_all ON public.playlist_tracks;
  DROP POLICY IF EXISTS "Users can manage tracks in their playlists" ON public.playlist_tracks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══ 2. Create explicit per-operation policies ═══════════════════════════════
-- Ownership is determined by joining playlist_tracks.playlist_id → playlists.id
-- and checking playlists.user_id = auth.uid(). playlists has its own RLS policy
-- (user_id = auth.uid()), but the subquery runs as the function owner (postgres)
-- during policy evaluation, so it bypasses playlists RLS and reads the raw row.

CREATE POLICY playlist_tracks_select ON public.playlist_tracks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ));

CREATE POLICY playlist_tracks_insert ON public.playlist_tracks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ));

CREATE POLICY playlist_tracks_update ON public.playlist_tracks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ));

CREATE POLICY playlist_tracks_delete ON public.playlist_tracks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playlists
    WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.user_id = auth.uid()
  ));

-- ═══ 3. Grant UPDATE (was missing from 20260905000001) ═══════════════════════

GRANT UPDATE ON public.playlist_tracks TO authenticated;


-- ==========================================================================
-- MIGRATION: 20260906000000_create_trending_cache.sql
-- ==========================================================================
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


-- ==========================================================================
-- MIGRATION: 20260907000000_create_search_cache.sql
-- ==========================================================================
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


-- ==========================================================================
-- MIGRATION: 20260907000001_create_avatars_storage.sql
-- ==========================================================================
-- Migration: Create public avatars bucket in Supabase Storage with user-scoped RLS policies.
--
-- Enables avatar uploads from the Profile page for both email/password and OAuth users.
-- Single source of truth is public.profiles.avatar_url.

-- 1. Insert avatars bucket into storage.buckets if not already existing
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Storage Policies for avatars bucket (wrapped safely so no ownership error occurs)
DO $$ BEGIN
  drop policy if exists "Public Avatars are readable by all" on storage.objects;
  drop policy if exists "Users can upload their own avatar" on storage.objects;
  drop policy if exists "Users can update their own avatar" on storage.objects;
  drop policy if exists "Users can delete their own avatar" on storage.objects;

  create policy "Public Avatars are readable by all"
    on storage.objects
    for select
    using (bucket_id = 'avatars');

  create policy "Users can upload their own avatar"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Users can update their own avatar"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Users can delete their own avatar"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'avatars' and
      (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ==========================================================================
-- MIGRATION: 20260911000000_create_audio_cache_and_playback_storage.sql
-- ==========================================================================
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


-- ==========================================================================
-- MIGRATION: 20260924000000_add_last_played_at_to_playback_cache.sql
-- ==========================================================================
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



-- ==========================================================================
-- SEED DATA
-- ==========================================================================
-- UTA-VERSE DEVELOPMENT/DEMO SEED DATA ONLY
--
-- This file is intentionally metadata-only. It does not contain audio URLs,
-- artwork URLs, credentials, or production content. Run it manually against a
-- development Supabase project after applying the migrations.
--
-- The fixed UUIDs make this seed safe to understand and reapply. It performs
-- upserts only; it does not delete or reset any tables.

insert into public.artists (id, name, image_url, bio, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'Aster House', null, 'Instrumental atmospheres for long-distance listening.', '2026-08-21T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'Mara Vale', null, 'Dream pop shaped by soft frequencies and open skies.', '2026-08-21T00:01:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'Lumen Field', null, 'Future soul, electric edges, and nocturnal signal.', '2026-08-21T00:02:00Z')
on conflict (id) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  bio = excluded.bio,
  created_at = excluded.created_at;

insert into public.albums (id, title, artist_id, artwork_url, release_date, created_at) values
  ('20000000-0000-4000-8000-000000000001', 'Gravity Studies', '10000000-0000-4000-8000-000000000001', null, '2026-01-16', '2026-08-21T00:10:00Z'),
  ('20000000-0000-4000-8000-000000000002', 'Soft Frequency', '10000000-0000-4000-8000-000000000002', null, '2026-03-06', '2026-08-21T00:11:00Z'),
  ('20000000-0000-4000-8000-000000000003', 'Signal / Noise', '10000000-0000-4000-8000-000000000003', null, '2026-05-22', '2026-08-21T00:12:00Z')
on conflict (id) do update set
  title = excluded.title,
  artist_id = excluded.artist_id,
  artwork_url = excluded.artwork_url,
  release_date = excluded.release_date,
  created_at = excluded.created_at;

insert into public.tracks (id, title, artist_id, album_id, artwork_url, audio_url, duration, track_number, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'Low Orbit', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null, null, 231, 1, '2026-08-21T00:20:00Z'),
  ('30000000-0000-4000-8000-000000000002', 'Weightless Room', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null, null, 204, 2, '2026-08-21T00:21:00Z'),
  ('30000000-0000-4000-8000-000000000003', 'Perigee', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null, null, 267, 3, '2026-08-21T00:22:00Z'),
  ('30000000-0000-4000-8000-000000000004', 'Silver Line', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, null, 244, 1, '2026-08-21T00:23:00Z'),
  ('30000000-0000-4000-8000-000000000005', 'Lucid Weather', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, null, 264, 2, '2026-08-21T00:24:00Z'),
  ('30000000-0000-4000-8000-000000000006', 'Quiet Current', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, null, 207, 3, '2026-08-21T00:25:00Z'),
  ('30000000-0000-4000-8000-000000000007', 'Static Bloom', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', null, null, 196, 1, '2026-08-21T00:26:00Z'),
  ('30000000-0000-4000-8000-000000000008', 'Afterimage', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', null, null, 218, 2, '2026-08-21T00:27:00Z'),
  ('30000000-0000-4000-8000-000000000009', 'Night Transit', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', null, null, 238, 3, '2026-08-21T00:28:00Z')
on conflict (id) do update set
  title = excluded.title,
  artist_id = excluded.artist_id,
  album_id = excluded.album_id,
  artwork_url = excluded.artwork_url,
  audio_url = excluded.audio_url,
  duration = excluded.duration,
  track_number = excluded.track_number,
  created_at = excluded.created_at;
