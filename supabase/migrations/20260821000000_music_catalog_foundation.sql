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
