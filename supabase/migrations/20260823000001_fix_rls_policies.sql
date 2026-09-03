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
