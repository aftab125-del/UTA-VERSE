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
