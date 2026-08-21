# UTA-VERSE architecture and NebulaMusic feature audit

Updated 2026-08-21 after inspecting the available worktree at
`C:\Users\aftab\.gemini\antigravity\scratch\NebulaMusic`.

This audit describes observed code and behavior only. The NebulaMusic project was
not modified. Its current worktree contains uncommitted changes, so findings are
based on the files currently present, not on an assumption that the last commit is
the complete product.

Status labels:

- **A — Implemented/reusable behavior:** product behavior exists and is a useful reference.
- **B — Partially implemented:** a meaningful slice exists, but important behavior or persistence is missing.
- **C — Broken/incomplete:** code exists but does not reliably deliver the intended behavior.
- **D — Native-only / web redesign required:** behavior depends on native APIs or native UX.
- **E — Not present:** no meaningful implementation was found.

## Executive summary

NebulaMusic is an Expo/React Native music app with four tabs: Home, Search,
Library, and Settings. It has email/password Supabase auth, a song search/catalog
adapter, liked songs, playlists, an in-memory player store, queue controls, a
native TrackPlayer implementation, native file downloads, a mini player, and a
full Now Playing modal.

The old app is not a source for a ready-made web architecture. Platform files
explicitly make several web features no-ops or stubs. In particular, the web
download service reports no downloaded files, the web playback service has no
Media Session integration, and history/settings are not durably restored. UTA-
VERSE should recover the behavior and product decisions, then reimplement them
behind the existing App Router, Supabase, `src/lib/audio`, and small Zustand
boundaries.

## Feature inventory

| Area | Status | Observed implementation and limitations | UTA-VERSE translation |
| --- | --- | --- | --- |
| Supabase configuration | **C** | `src/services/supabaseService.ts` creates a Supabase client with a hard-coded project URL and anon key. Storage is platform-selected: SecureStore native, localStorage web, and a no-op base fallback. The unused `SESSION_STORAGE_KEY` is evidence of an unfinished path. | Use environment variables. Keep browser/server clients behind `src/lib/supabase`; use `@supabase/ssr` cookies for server-rendered auth and typed feature data boundaries. Never copy the embedded credentials. |
| Supabase database usage | **B** | Observed tables are `liked_songs`, `playlists`, and `playlist_songs`. Rows duplicate song metadata (`title`, `artist`, `thumbnail`, `duration`, `preview_url`) instead of referencing a catalog entity. Reads are split into three requests. Playlist sync upserts playlists, deletes all user playlist songs, then reinserts them. | Recover the product concepts, not this destructive sync strategy. Design typed tables/RLS for catalog entities, user likes, playlists, ordered playlist items, and any durable playback history. Validate the actual project/schema before implementation. |
| Authentication | **B** | Email/password sign-up and sign-in exist in `AuthScreen`; the app checks `getSession()` on startup, loads user data, and gates navigation on a Zustand user. Logout calls Supabase sign-out and clears likes/playlists. | Use Supabase Auth with server-aware session restoration, middleware/layout route protection, explicit loading/error states, and `onAuthStateChange`. Keep auth state separate from player state. |
| Session handling | **C** | Session persistence is delegated to platform storage. There is no route-level session boundary, no visible auth event subscription, and no robust recovery/error model. The web storage path is localStorage rather than SSR cookie handling. | Implement browser/server session helpers and cookie refresh. Treat session restoration and user-data loading as separate concerns. |
| Songs/music catalog | **B** | `pipedService.ts` defines a `Song` contract and searches iTunes for up to 25 songs with preview URLs, artwork, duration, artist, release date, and track URL. Playback then searches YouTube and asks a Render backend for `/stream/{videoId}`. This is a song/preview discovery flow, not a first-party catalog. API keys and external endpoints are hard-coded. | Create a provider boundary and server-side catalog/search adapters. Store normalized song metadata only where product ownership/licensing permits; do not bake iTunes/YouTube assumptions into UI or database contracts. |
| Artists | **E — Not present as a domain** | Artist is a string field on `Song`. No artist entity, artist detail screen, artist search result type, or artist-owned catalog was found. | Model artist as a first-class domain only when the chosen catalog source supports it; otherwise keep provider artist metadata as a song field. Do not invent artist pages from this audit. |
| Albums | **E — Not present as a domain** | No album field/entity, album screen, album grouping, or album navigation was found. Artwork is attached to a song result. | Do not implement album behavior as recovered functionality. Add an album boundary only after catalog/schema decisions establish real album data. |
| Playlists | **A/B** | Users can create, delete, select, play, add songs to, and remove songs from playlists. Playlist items are deduplicated in memory and ordered on sync. Persistence is cloud-backed for signed-in users, but sync is whole-collection and errors are only logged. | Use feature-level playlist actions and server mutations with optimistic updates, rollback, ordered join rows, ownership/RLS, and clear mutation errors. |
| Liked songs | **A/B** | The player and song cards toggle likes optimistically. Individual insert/delete is attempted, with full-user replacement sync as fallback. Initial likes load from Supabase. The code caps in-memory likes at 100 and duplicates metadata in rows. | Keep optimistic like UX, but use idempotent typed mutations, unique constraints, RLS, and a durable user-song relation. Avoid silent fallback failures. |
| Search | **A/B** | Search screen calls the iTunes adapter, supports submit/search history (up to 10), clear/delete history, trending landing results, no-results/loading states, and song actions. Search history uses AsyncStorage and is not cloud-backed. Search placeholder mentions artists/playlists that are not searched. | Build a server/client search boundary with debouncing/cancellation, accessible web input, URL state where useful, provider error handling, and a clearly scoped result model. Persist recent queries in local storage only if that remains the product decision. |
| Search history | **B** | Recent queries are saved, deduplicated case-insensitively, capped at 10, and deletable. No migration, expiry, or cross-device sync. | Browser storage adapter with safe hydration; keep query history separate from listened-track history. |
| `playerStore` / state | **A/B** | Zustand store contains current track, playing/loading/progress, volume/mute, quality, queue/index, shuffle/repeat, in-memory history, likes, playlists, sleep timer, crossfade setting, and download state. It also owns service calls and Supabase mutations, so it is a large orchestration boundary. It imports AsyncStorage directly and has native assumptions in the shared path. | Keep a small player store for UI state and commands. Move catalog/account/playlist mutations to feature services; keep all browser audio orchestration behind `src/lib/audio`; add explicit persistence adapters. |
| Queue | **A** | Supports set/play queue, add, play next, remove, clear, reorder, shuffle upcoming items, next/previous, shuffle mode, repeat off/all/one, and active index tracking. Queue is in memory only. | Preserve these semantics in a queue domain/service. Define duplicate policy and whether queue survives refresh; use accessible drag/reorder controls on web. |
| Playback | **A native / B web** | Native TrackPlayer setup supports play/pause/seek/volume, progress events, next/previous capabilities, completion handling, local-file-first playback, and fade helpers. Web uses one `HTMLAudioElement`, time/progress/waiting/playing/ended/error listeners, and basic play/pause/seek/volume. Web `skipToNext()` always returns false. | Implement a browser audio engine with lifecycle cleanup, source/load cancellation, progress/error events, autoplay rejection handling, and a Media Session adapter. Keep transport commands out of page components. |
| Playback quality | **C** | UI offers low/medium/high and replay-loads the track, but the observed stream resolver does not use the quality value to select a bitrate. | Do not expose a quality control until the provider actually supports variants; otherwise document it as unavailable. |
| Now Playing | **A native UX / D web redesign** | Full-screen modal has artwork/background, title/artist, like, waveform, seek slider, elapsed/total time, play/pause, previous/next, shuffle, repeat, volume, queue sheet, download progress/retry, and sleep timer. It is implemented as React Native modal/layout. | Rebuild as an accessible responsive route/dialog with focus management, reduced-motion behavior, keyboard controls, and shared player commands. |
| Mini player | **A native UX / D web redesign** | Persistent floating mini player shows artwork, title/artist, play/pause, next, and progress; opens Now Playing. It sits above the native tab bar. | Build a responsive web player dock that accounts for route content, mobile safe areas, keyboard/focus, and the global audio engine. |
| Recently played/history | **B/C** | Playing a song prepends it to an in-memory list, de-duplicates by song ID, and caps it at 50. Home and Library display it. It is not persisted, sent to Supabase, timestamped, or restored after restart. | Decide whether history is local or account-owned, then model timestamps and retention. Do not confuse it with search history. |
| Downloads/offline | **A native / D web redesign** | Native uses Expo FileSystem, a songs directory, temporary files, progress callbacks, cancellation, integrity checks, storage usage, per-song deletion, and clear-all. Playback downloads before playing when no local file exists. The web implementation returns the resolved stream URL, reports zero downloaded IDs/storage, and all deletion/check operations are false/no-op. | Treat browser offline as a product/licensing decision. If approved, design an IndexedDB/Cache/Service Worker strategy with quota, eviction, protected content rules, and download UX. Do not carry over native file APIs. |
| Storage/persistence | **B/C** | Native auth uses SecureStore; web auth storage uses localStorage; crossfade uses AsyncStorage; search history uses AsyncStorage; player queue/history/likes/playlists are not locally persisted. The base appStorage fallback is a no-op. | Provide explicit browser storage adapters (localStorage/IndexedDB as appropriate), SSR-safe hydration, and persistence policies per domain. |
| Home/discovery UI | **B** | Home fetches a hard-coded “top hits 2024” query, shows a featured/grid set, recently discovered history, and reusable song cards/actions. There is no curated first-party home data, artist/album sections, or evidence of Ballpit. | Recover the interaction inventory and visual direction only. Build server-renderable discovery sections from real product data; defer Ballpit until the visual-foundation task explicitly calls for it. |
| Library UI | **A/B** | Library shows liked songs, recently played, playlists, selected playlist detail, play-all/play item behavior, add-to-queue/like/playlist actions, removal, and playlist deletion. Queue controls are exposed. | Split into route-level server composition and client islands for mutations/player interaction. Preserve empty states and collection actions. |
| Settings UI | **B/C** | Settings includes account email/logout, quality selector, crossfade selector, sleep timer presets/cancel, storage usage/clear downloads, an “About” section, and an explicitly labeled isolated debug slider test. Quality is not wired to actual stream variants; native storage actions are unavailable on web. | Rebuild only product settings. Exclude debug UI. Separate account, playback, storage, and about sections; show web capability/unsupported states rather than fake downloads. |
| Navigation | **A native UX / D web redesign** | React Navigation bottom tabs: Home, Search, Library, Settings, plus global MiniPlayer. Native blur/safe-area/tab-bar styling is used. | Use App Router routes/layouts with responsive navigation and a persistent player layout. Preserve the four information-architecture areas without copying native navigation code. |
| Visual components | **A reusable concepts / D implementation** | `SongCard`, `PlaylistPickerModal`, `GlassView`, `Waveform`, `CustomSlider`, `MiniPlayer`, and `NowPlayingModal` provide reusable UI concepts. They depend on React Native, Expo icons/gradient/blur, and native modals/sliders. Waveform heights use random values during render, which is not stable. | Recreate accessible HTML/CSS components in focused domains. Make animation deterministic or CSS-driven, honor reduced motion, and keep decorative effects subordinate to playback usability. |
| Sharing/song info | **B** | Song card action sheet supports native Share and a basic alert with title, artist, and duration. | Use Web Share API with clipboard fallback and an accessible details surface. Treat this as a small reusable song action, not a catalog feature. |
| Media Session / lock-screen controls | **D** | Native TrackPlayer exposes notification/lock-screen capabilities. Web registration and playback service are explicit no-ops; no `navigator.mediaSession` code was found. | Implement Media Session metadata and action handlers in `src/lib/audio`, with feature detection and cleanup. |
| Background playback | **D** | Native playback service is registered with TrackPlayer. Web service is a no-op and has no equivalent background strategy beyond browser audio behavior. | Rely on browser audio plus Media Session where supported; document browser limitations and avoid promising native-style background behavior. |
| Authentication UI | **B** | Login/sign-up toggle, email/password fields, loading, and error text exist. There is no password reset, email verification flow, OAuth, or SSR-aware route handling observed. | Start with the supported Supabase flow and add other methods only from an explicit product decision. |
| Ballpit / major visual effects | **E** | No Ballpit implementation or dependency was found. | Do not infer or implement it during schema/auth recovery; the UTA-VERSE guardrail explicitly defers Ballpit. |

## Important implementation defects and risks to carry forward

These are easy to forget if the old app is treated as a feature checklist rather
than as behavior with edge cases:

1. The catalog path is two external services: iTunes search/preview metadata and
   a YouTube API plus Render stream resolver. Licensing, availability, CORS,
   rate limits, API-key handling, and server-side proxying are unresolved.
2. Supabase credentials are embedded in old source. They must not be copied into
   UTA-VERSE; use environment variables and verify the target project separately.
3. The actual persisted schema observed is only `liked_songs`, `playlists`, and
   `playlist_songs`; there is no evidence for songs, artists, albums, history, or
   settings tables.
4. Playlist and liked-song sync is optimistic and mostly logs failures. Whole-
   collection delete/reinsert sync can lose changes and needs a safer web design.
5. History, queue, volume/mute, shuffle/repeat, sleep timer, and most settings are
   process-local. Only selected settings/search history have storage paths.
6. Native playback downloads every not-already-local track before playing. This
   is materially different from normal streaming and must not be silently copied
   to web.
7. Web download functions are deliberately stubs, not offline support. Web
   playback also lacks Media Session and native skip optimization.
8. The old store mixes UI state, persistence, Supabase writes, downloads, and
   audio orchestration. Recover the commands and invariants while keeping UTA-
   VERSE boundaries separate.
9. `playTrack` adds or replaces queue state and immediately records history before
   playback succeeds; failed playback can therefore appear as recently played.
10. Search advertises songs, artists, and playlists, but only song search is
    implemented. Artist and album product surfaces are absent entirely.
11. Settings contains an explicit debug-only slider test. It is not product
    behavior and should not be carried into UTA-VERSE.
12. Native-only UX includes safe areas, blur, gradients, native bottom sheets,
    haptics-capable interaction patterns, TrackPlayer notifications, Expo file
    storage, SecureStore, and native share. Each needs an intentional browser
    equivalent or an explicit unsupported state.

## Recommended UTA-VERSE boundaries

Keep the existing Phase 0 foundation intact and use these boundaries as the
recovery map:

- `src/app`: App Router layouts/routes and server-rendered composition.
- `src/features/auth`: session-aware auth UI and use cases.
- `src/features/catalog`: song/search provider contracts and normalized models;
  add artists/albums only when supported by an approved source.
- `src/features/library`: likes, playlists, and history data boundaries.
- `src/lib/supabase`: browser/server clients, typed queries, and RLS-facing data
  access.
- `src/lib/audio`: HTML5 Audio engine, Media Session adapter, queue/playback
  commands, and lifecycle cleanup.
- `src/stores`: small client-global player/session UI state only.
- `src/components`: accessible, responsive song cards, collection views, player
  dock, and Now Playing surfaces.
- `src/lib/storage`: explicit browser persistence policies and adapters if the
  feature needs local state or offline capability.

No authentication, schema, Home UI, Ballpit, or other major feature was
implemented as part of this audit.
