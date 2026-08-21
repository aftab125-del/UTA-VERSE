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
