# Phase 3.1 — Supabase music data foundation

This phase establishes the database and typed data-access boundaries for the UTA-VERSE catalog. It does not connect the existing pages, implement authentication, seed content, add likes/history, or change playback.

## Boundaries

- `src/lib/supabase/browser.ts` creates the browser-safe SSR client with only the public URL and anon key.
- `src/lib/supabase/server.ts` creates a request-scoped server client with the same public credentials and Next cookie handling. A service-role key is intentionally absent.
- `src/types/database.ts` is the checked-in Supabase-compatible contract for the migration. Application presentation contracts remain in `src/types/music.ts`.
- `src/lib/music/catalog.ts` is the typed catalog repository. Pages and components can consume application-friendly `Track`, `Album`, and `Artist` values without querying Supabase directly.
- `supabase/migrations/20260821000000_music_catalog_foundation.sql` defines the normalized catalog and ordered, user-owned playlists.

## Schema decisions

Artists, albums, and tracks are public catalog records. A track has one required artist and an optional album because that is the smallest model consistent with the current product surfaces. Playlists include `user_id` because they are account-owned in the recovered product behavior; playlist rows and ordered membership are protected by RLS. Likes, playback history, profiles, storage buckets, and provider-specific metadata remain deliberately deferred until their ownership and retention policies are approved.

The migration uses UUIDs, foreign keys, timestamps, duration/position checks, indexes for relationship lookups, and uniqueness for both playlist membership and ordering. It is intentionally a foundation rather than a complete production catalog import.

## Environment and security

`.env.example` contains empty `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` placeholders. `.gitignore` ignores `.env*` while explicitly allowing only `.env.example`. No real credentials or service-role access were added.
