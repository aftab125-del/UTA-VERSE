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
