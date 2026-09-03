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
