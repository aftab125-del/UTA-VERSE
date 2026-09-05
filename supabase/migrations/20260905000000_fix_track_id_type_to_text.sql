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
