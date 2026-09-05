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
