# Phase 3.3A — Development catalog seed

`supabase/seed.sql` contains the small UTA-VERSE development/demo dataset for verifying the existing Supabase-to-catalog pipeline.

## Dataset

- 3 artists
- 3 albums
- 9 tracks
- Every album belongs to one seeded artist.
- Every track belongs to one seeded artist and album.
- IDs and timestamps are deterministic.

## Media policy

This seed intentionally sets `artwork_url` and `audio_url` to `NULL`. No legitimate, approved audio assets or artwork sources were available in the repository, so the seed does not pretend playback is ready and does not invent media endpoints.

The existing UI falls back gracefully for missing artwork. Playback verification remains blocked until legitimate development audio assets are approved and supplied.

## Safe usage

Apply the migration first, then run `supabase/seed.sql` manually in a development Supabase project. Do not run it against production. The file uses deterministic UUID upserts and contains no delete, truncate, reset, credential, or service-role statements.

After applying it, verify the relationships with the existing pages and repository functions:

```sql
select count(*) from public.artists;
select count(*) from public.albums;
select count(*) from public.tracks;

select artists.name, albums.title, tracks.title, tracks.track_number
from public.tracks
join public.artists on artists.id = tracks.artist_id
join public.albums on albums.id = tracks.album_id
order by artists.name, albums.title, tracks.track_number;
```

The application pages already use `src/lib/music/catalog.ts`; no seed-specific queries or UI paths were added.
