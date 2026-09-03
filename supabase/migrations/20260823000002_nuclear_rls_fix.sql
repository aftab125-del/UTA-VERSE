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
