# UTA-VERSE product and implementation blueprint

Status: Phase 1 planning document. No application feature implementation is
authorized by this document.

This blueprint uses the existing UTA-VERSE foundation, the repository audit in
`docs/architecture-audit.md`, and the currently available NebulaMusic worktree as
a feature reference. NebulaMusic remains an Expo/React Native application and
must not be copied as architecture.

## 1. Product architecture

UTA-VERSE is a browser-first, dark, cinematic music platform. The architecture
will preserve the intended product behavior recovered from NebulaMusic while
replacing native-only services with Web APIs and keeping each concern behind a
small boundary.

```text
App Router routes/layouts
        |
        +-- server-rendered feature composition
        |       +-- catalog/search read models
        |       +-- library/authenticated data
        |
        +-- client interaction islands
                +-- player controls and Now Playing
                +-- queue and collection mutations
                +-- visual effects

Feature use cases --> Supabase data access
                  --> catalog/provider adapters
                  --> audio commands

Audio engine --> HTMLAudioElement --> player store --> UI subscriptions
             --> Media Session API
```

Boundaries:

- `src/app`: routes, layouts, metadata, and server/client composition.
- `src/features`: feature use cases and feature-level UI orchestration.
- `src/components`: reusable presentation components with no direct data-provider coupling.
- `src/lib/supabase`: server/browser clients, session helpers, typed queries, and mutations.
- `src/lib/audio`: browser audio engine, Media Session adapter, and playback events.
- `src/stores`: small client-global state, beginning with player state.
- `src/lib/storage`: explicit browser persistence adapters when local state is required.
- `src/types`: shared domain contracts and generated database types when the schema exists.

Server Components remain the default. Client boundaries are reserved for browser
APIs, local interaction, optimistic mutation state, and visual effects.

## 2. Feature matrix

Priority: P0 is required for a usable first product slice; P1 is important after
the core; P2 is deferred or conditional. Status refers to NebulaMusic.

| Feature | Existing status | Existing implementation location | UTA-VERSE decision | Web approach | Dependencies/services | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase client | C | `src/services/supabaseService.ts` | REPLACE | Env-configured server/browser clients behind `src/lib/supabase` | `@supabase/ssr`, Supabase | P0 |
| Email/password auth | B | `src/screens/AuthScreen.tsx`, `src/store/authStore.ts` | REBUILD | Server-aware sign-in/sign-up forms and route/session boundary | Supabase Auth, cookies | P0 |
| Session restoration | C | `App.tsx`, `supabaseService.ts`, `appStorage.*` | REBUILD | Cookie refresh, `onAuthStateChange`, loading/error states | Next middleware/layout, Supabase SSR | P0 |
| User profile | E | No profile domain found | NEW UTA-VERSE | Minimal profile row only if product needs account metadata | Supabase Auth + profiles table | P1 / approval |
| Song catalog | B | `src/services/pipedService.ts` | REPLACE | Provider-neutral catalog contract and normalized read models | Approved catalog/provider API | P0 |
| Artist domain/pages | E | Only `Song.artist` string exists | NEW UTA-VERSE | Add only after source supports stable artist identity | Catalog provider, artist routes | P1 / approval |
| Album domain/pages | E | No album field/entity found | NEW UTA-VERSE | Add only after source supports album identity and artwork | Catalog provider, album routes | P1 / approval |
| Song search | B | `src/screens/SearchScreen.tsx`, `pipedService.ts` | REBUILD | Server-backed provider adapter, debounced client query, typed results | Search provider, caching/rate limits | P0 |
| Search history | B | `SearchScreen.tsx`, AsyncStorage | REBUILD | Safe local browser persistence, delete/reuse, separate from listening history | localStorage or IndexedDB | P1 |
| Trending discovery | B | `HomeScreen.tsx`, hard-coded `top hits 2024`; `SearchScreen.tsx`, `top music` | REBUILD | Data-driven discovery sections with provider/catalog ownership | Catalog read model, caching | P1 |
| Liked songs | A/B | `playerStore.ts`, `supabaseService.ts`, `LibraryScreen.tsx` | REBUILD | Optimistic like/unlike actions with typed relation and rollback | Supabase RLS, `liked_songs` | P0 |
| Playlists | A/B | `playerStore.ts`, `supabaseService.ts`, `LibraryScreen.tsx`, `PlaylistPickerModal.tsx` | REBUILD | Feature service plus ordered playlist items and mutation feedback | Supabase RLS, playlists tables | P0 |
| Playlist picker | A | `PlaylistPickerModal.tsx` | REBUILD | Accessible dialog/popover independent of player/catalog services | React client island | P0 |
| Playlist detail | A/B | `LibraryScreen.tsx` | REBUILD | `/library/playlists/[id]` route with server data and client actions | Supabase playlist queries | P1 |
| Player store | A/B | `src/store/playerStore.ts` | REBUILD | Small Zustand state and command façade; no direct page orchestration | Zustand, audio command interface | P0 |
| Queue | A | `playerStore.ts`, `NowPlayingModal.tsx` | REBUILD | Queue domain with active index, duplicate policy, reorder actions | Zustand, audio engine | P0 |
| Playback controls | A native / B web | `audioService.ts`, `audioService.web.ts`, `MiniPlayer.tsx`, `NowPlayingModal.tsx` | REBUILD | HTML5 Audio engine with explicit events and command methods | HTMLAudioElement | P0 |
| Shuffle/repeat | A | `playerStore.ts`, `audioService.*` | REBUILD | Deterministic queue policy for off/all/one and shuffle | Queue service, Zustand | P0 |
| Progress/buffering | A native / B web | `audioService.web.ts`, `useProgress.*` | REBUILD | `timeupdate`, `loadedmetadata`, `progress`, `waiting`, `canplay`, `error` | HTMLAudioElement | P0 |
| Mini player | A native UX | `src/components/MiniPlayer.tsx` | REDESIGN | Responsive persistent player dock in app layout | Player store, audio engine | P1 |
| Now Playing | A native UX | `src/components/NowPlayingModal.tsx` | REDESIGN | Accessible responsive route/dialog with focus management | Player store, queue, Media Session | P1 |
| Recently played | B/C | `playerStore.ts`, `HomeScreen.tsx`, `LibraryScreen.tsx` | REBUILD | Timestamped local/account history with explicit retention | Supabase or browser storage | P1 / approval |
| Native offline downloads | A native / D web | `downloadService.native.ts`, `SettingsScreen.tsx` | REPLACE | Conditional browser offline design using Cache/IndexedDB only if approved | Storage quota, service worker, licensing | P2 / approval |
| Web download fallback | C | `downloadService.web.ts` | DROP | Do not represent a stream URL as a completed download | None until approved design | P0 decision |
| Media Session | E web / native capability | `registerPlaybackService.web.ts`, native TrackPlayer setup | REBUILD | `navigator.mediaSession` metadata and action handlers | Media Session API | P1 |
| Background playback | D | `playbackService.native.ts`, web no-op | REDESIGN | Browser audio plus best-effort Media Session; document limitations | Browser support | P1 |
| Playback quality | C | `playerStore.ts`, `SettingsScreen.tsx` | DROP until supported | Expose only provider-backed variants | Catalog/stream provider | P2 |
| Sleep timer | A | `playerStore.ts`, `App.tsx`, settings/Now Playing | REBUILD | Client timer service with cleanup and pause command | Zustand, browser timer | P1 |
| Crossfade | B/C | `playerStore.ts`, native `audioService.ts` | REDESIGN | Defer until dual-source audio strategy is proven | Audio engine, product approval | P2 |
| Volume/mute | A | `playerStore.ts`, audio services, Now Playing | REBUILD | HTMLAudioElement volume and persisted preference | Audio engine, local storage | P1 |
| Song actions | B | `SongCard.tsx` | REBUILD | Accessible menu: play next, queue, like, playlist, info, share | Web Share API/clipboard | P1 |
| Native navigation | A native UX | `src/navigation/AppNavigator.tsx` | REDESIGN | App Router routes plus responsive desktop/mobile navigation | Next.js App Router | P0 |
| Home visual effects | E for Ballpit | No Ballpit found | REBUILD later | Ballpit may be a Home background layer only after visual foundation approval | React Bits Ballpit, client island | P1 |
| Glass/gradient/waveform UI | A native concepts | `GlassView.tsx`, `Waveform.tsx`, Expo blur/gradient | REDESIGN | CSS tokens and independent presentational components | CSS, optional approved React Bits | P1 |
| Settings | B/C | `SettingsScreen.tsx` | REBUILD | Account, playback, timer, storage capability, and about sections | Auth, player, storage | P1 |
| Debug slider | Present but debug-only | `SettingsScreen.tsx` | DROP | Do not ship | None | — |

## 3. Domain and data model

No migrations should be created until the target Supabase project, ownership
model, catalog source, and licensing constraints are approved. The old project
only proves usage of `liked_songs`, `playlists`, and `playlist_songs`; it does not
prove that a complete catalog schema exists.

### Proposed domains

| Domain | Proposed role | Evidence / decision |
| --- | --- | --- |
| `auth.users` | Supabase-managed identity | Existing auth uses Supabase users. Do not duplicate passwords or sessions. |
| `profiles` | Optional user-facing account metadata | NEW UTA-VERSE; add only fields with a real product use. |
| `songs` | Normalized catalog identity and provider metadata | Existing `Song` fields are scattered into user-owned rows; normalize only after catalog ownership is decided. |
| `artists` | Stable artist identity and display metadata | Not present in old app; required only for approved artist pages/search. |
| `albums` | Stable album identity, artwork, release metadata | Not present in old app; required only for approved album pages/search. |
| `song_artists` / `album_artists` | Many-to-many credits | Conditional; avoid assuming one artist per song because the old string field hides collaboration structure. |
| `playlists` | User-owned collection metadata | Reuses old concept and `id/name/user_id` shape, redesigned with ownership constraints and timestamps. |
| `playlist_items` | Ordered playlist membership | Replaces `playlist_songs`; use a stable song reference and explicit position. |
| `liked_songs` | User-to-song relation | Reuses old concept but should reference a normalized song and enforce uniqueness. |
| `playback_history` | Optional durable listening events or latest-played rows | Not present; requires a product decision on account sync, retention, and privacy. |

### Required modeling decisions

- Whether UTA-VERSE owns catalog metadata or references a licensed external catalog.
- Whether provider IDs are stable enough to be primary external keys.
- Whether a song may have multiple audio sources/variants and how source choice is stored.
- Whether playlist items snapshot metadata or always resolve current catalog data.
- Whether history is account-owned, device-local, or both.
- Retention, deletion, and privacy rules for playback history.
- RLS policies for every user-owned relation.

The old duplicated snapshot fields (`title`, `artist`, `thumbnail`, `duration`,
`preview_url`) are useful evidence for the UI’s minimum display needs, but are not
automatically the final schema.

## 4. Browser-first audio architecture

### Components

`AudioEngine` is a browser-only service in `src/lib/audio`. It owns one
`HTMLAudioElement`, listeners, source loading, cleanup, and low-level media
events. It exposes commands and event subscriptions; it does not import React
components.

`PlayerController` translates product commands (play song, next, previous,
repeat, shuffle, queue changes) into engine commands and store updates. It owns
race protection for source changes so an old request cannot overwrite a newer
track.

`player-store.ts` contains serializable UI state and stable commands/selectors:
current track, status, position, duration, buffered range, volume/mute, queue,
active index, shuffle/repeat, and user-visible errors. It should not contain
Supabase query code or provider-specific stream resolution.

`MediaSessionAdapter` receives current metadata and registers supported action
handlers. It is feature-detected and disconnected/updated when the track changes.

### Behavior contract

- **Play:** resolve an approved playable source, set it on the engine, load metadata, then call `play`; surface autoplay rejection without corrupting state.
- **Pause/resume:** call engine methods and derive authoritative state from media events.
- **Seek:** clamp to known duration, update the engine, and reflect seek/buffering state.
- **Volume/mute:** clamp `0..1`; preserve the previous non-zero volume for unmute.
- **Progress:** consume `timeupdate` or a controlled animation loop, respecting reduced motion and avoiding excessive store writes.
- **Buffering:** map `waiting`, `stalled`, `canplay`, and `progress` to explicit loading/buffered state.
- **Duration:** use `loadedmetadata`/`durationchange`; provider duration is only a fallback.
- **Queue:** maintain the active item separately from upcoming items and define duplicate behavior.
- **Next/previous:** apply repeat and shuffle policy in one queue service; do not let UI components decide indexes.
- **Ended:** engine emits completion; controller advances according to repeat/shuffle policy.
- **Loading/error:** every source change has loading, ready, paused, ended, and error outcomes.
- **Source changes:** abort or invalidate stale loads, pause old media, remove old source, and clean listeners once.
- **Persistence:** persist only explicitly approved preferences and optionally queue; never persist transient media objects blindly. Restore after client hydration.

The engine must not be constructed during server rendering. Every listener,
timer, animation loop, and Media Session handler must have cleanup.

## 5. Content and streaming architecture

### CURRENT LEGACY APPROACH

The observed old flow is:

1. `pipedService.searchSongs(query)` calls the iTunes Search API with `media=music`, `entity=song`, and a limit of 25.
2. Results are filtered to `kind === 'song'` and `previewUrl`, then mapped to the local `Song` shape with iTunes track ID, title, artist, duration, artwork, preview URL, track URL, views, and release date.
3. `getAudioStreamUrl(song)` constructs a YouTube search for `title + artist + official audio`.
4. It calls the YouTube Data API with a hard-coded API key, takes the first video ID, and returns `https://nebula-music-server.onrender.com/stream/{videoId}`.
5. Native playback downloads that resolved stream to Expo FileSystem before playing it. Web playback calls the resolved URL through its `HTMLAudioElement`; the web download service is a no-op stub.

What is actually streamed is therefore a backend-resolved audio stream based on
the first YouTube search result, not the iTunes preview URL in the normal player
path. The iTunes preview URL is stored in song metadata and database snapshots,
but the observed resolver does not use it for normal playback.

Cached/persisted behavior:

- Native audio files are stored under an Expo document `songs` directory.
- Web has no completed download cache; downloaded IDs and storage usage remain empty/zero.
- Likes/playlists are stored in Supabase for authenticated users.
- Search history is local AsyncStorage; playback history is in memory.

Credentials and services:

- Supabase URL and anon key are hard-coded in `supabaseService.ts`.
- YouTube API key is hard-coded in `pipedService.ts`.
- iTunes Search is called directly without an application credential.
- The Render stream backend is a fixed public endpoint.

Licensing, terms of service, source availability, API quota, CORS, backend
availability, first-result correctness, and rights to cache or download the
audio are unresolved. This is not automatically a production architecture.

### Proposed UTA-VERSE content boundary

Define a provider-neutral `CatalogProvider` and `PlaybackSourceResolver`.
Provider adapters should run server-side where credentials, rate limits, and
normalization require protection. The UI receives typed normalized metadata and
an approved playable source or a clear unavailable state. The resolver must not
silently infer a stream from an unrelated search result.

The permanent source strategy requires product/legal approval. Until then,
implement no replacement provider and do not present the legacy YouTube/Render
path as production-ready.

## 6. Supabase architecture

- Browser client: only the public anon key from environment configuration, with the SSR cookie adapter.
- Server client: request-scoped client using the user session; never a service-role key in browser bundles.
- Data access: feature repositories/use cases under `src/features/*/data` or `src/lib/supabase`, not inside page components.
- Writes: typed, idempotent mutations with explicit error results and optimistic rollback where appropriate.
- Security: RLS on every user-owned row; test ownership for likes, playlists, playlist items, and history.
- Session: middleware refresh plus server checks for protected routes; client subscriptions only for interactive state.
- Types: generate or maintain database types after schema approval; avoid `any` row mapping.

## 7. Security model

The old project contains credential material in source. UTA-VERSE must not copy
it. Rotate/revoke any exposed secrets in the legacy project as an operational
follow-up if they are still active.

`.env.local` / deployment secret storage:

- `NEXT_PUBLIC_SUPABASE_URL`: safe to expose as a public client configuration value.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: intended for browser exposure, protected by RLS and never treated as a secret.
- Server-only provider keys, stream-service credentials, service-role keys, signing secrets, and private API tokens: no `NEXT_PUBLIC_` prefix; server-only.

Rules:

- Never commit `.env.local` or real secret values.
- Never place service-role Supabase keys in client modules.
- Never put YouTube/provider private keys in browser code.
- Validate and rate-limit server-side provider calls.
- Do not let user-supplied catalog IDs become arbitrary backend fetch targets without validation.
- Treat downloads/cache as a rights and data-protection feature, not a simple file API.

## 8. UI and design architecture

Primary surfaces:

- **Landing/auth:** public entry, sign-in/sign-up, session errors, and product introduction.
- **Home:** discovery, featured/trending sections, recent listening, and entry points into catalog content.
- **Search:** query input, recent searches, results, song actions, loading/error/empty states.
- **Library:** liked songs, playlists, recently played, and downloaded/offline state only if supported.
- **Playlist:** playlist metadata, ordered songs, play-all, queue actions, and edit controls.
- **Album:** album artwork/metadata and ordered track list when the catalog supports albums.
- **Artist:** artist identity and catalog sections when the catalog supports artists.
- **Now Playing:** artwork, transport, seek, queue, repeat/shuffle, volume, and supported extras.
- **Settings:** account, playback preferences, timer, supported storage/offline capabilities, and about.

Reusable layout primitives should include app shell, responsive navigation,
surface/card, section header, song row/card, artwork, action menu, dialog/sheet,
empty state, loading state, error state, player dock, and Now Playing shell.
Presentation components receive domain data and callbacks; they do not call
Supabase or resolve playback sources directly.

## 9. React Bits strategy

Ballpit is the first approved React Bits component for the Home background. It
is integrated through a client-only visual boundary; no additional React Bits
component should be installed without a separately scoped visual-foundation task.

Rules for future integration:

- One component at a time, with a documented purpose and replacement path.
- Keep it in a visual/presentation boundary; it must not own catalog, auth, or player logic.
- Load client-only effects behind a client boundary and avoid server-render assumptions.
- Keep Ballpit behind content, with `pointer-events: none`, responsive parent sizing, and explicit reduced-motion fallback.
- The installed registry source uses `three@0.180.0` with its official renderer options. Browser diagnosis found that the target environment reaches Three's `WebGLState` with `gl.getParameter(gl.VERSION) === null`; this is an invalid/lost/partial WebGL context condition, not a Ballpit renderer-option incompatibility. Keep the source options unchanged until the browser's WebGL context passes the isolated test.
- Ballpit lifecycle adaptation: its cleanup retains `renderer.dispose()` but does not call `forceContextLoss()`. The latter deliberately loses the canvas context and conflicts with React Strict Mode's development setup/cleanup/setup cycle on the same canvas.
- Respect `prefers-reduced-motion`; offer a static or reduced-intensity mode.
- Make effects decorative, non-interactive unless interaction is explicitly required, and never obscure text or controls.
- Pause or reduce work when offscreen or when the page is hidden where practical.
- Test mobile viewport size, touch behavior, low-power devices, keyboard navigation, and contrast.
- Keep the player and essential content visually dominant over background effects.

## 10. Implementation roadmap

The recommended order adjusts the supplied sequence slightly so contracts and
security precede feature UI:

1. **Phase 1 — Blueprint:** this document, audit alignment, decisions register.
2. **Phase 2 — Environment and Supabase foundation:** env validation, server/browser clients, session helpers, and RLS/schema decision record.
3. **Phase 3 — Authentication:** email/password flow, session restoration, protected shell, logout, and error handling.
4. **Phase 4 — Domain contracts/data layer:** typed catalog, songs, playlists, playlist items, likes, and only approved history/profile models.
5. **Phase 5 — Browser audio engine:** HTML5 Audio lifecycle, event model, source resolver interface, and tests for command/state transitions.
6. **Phase 6 — Player state and queue:** Zustand selectors/actions, queue semantics, shuffle/repeat, persistence policy, and sleep timer.
7. **Phase 7 — Application shell/navigation:** App Router layouts, responsive navigation, route loading/error boundaries, and player dock slot.
8. **Phase 8 — Visual foundation:** design tokens, surfaces, typography, responsive primitives, and accessibility baseline.
9. **Phase 9 — Catalog/search:** approved provider adapter, search UX, trending/discovery read models, and recent query storage.
10. **Phase 10 — Library collections:** likes, playlists, playlist detail, recently played, and collection mutation feedback.
11. **Phase 11 — Now Playing polish:** responsive full player, queue surface, keyboard controls, focus management, and share/info actions.
12. **Phase 12 — Media Session and capability features:** Media Session, supported background behavior, and only then offline/download feasibility.
13. **Phase 13 — Home and React Bits:** Home composition and Ballpit after performance/accessibility checks; no additional effects without explicit scope.
14. **Phase 14 — Production hardening:** responsive QA, reduced motion, security review, provider failure modes, observability, performance, and deployment checks.

Each phase should produce a small coherent boundary and verified behavior before
the next dependent phase begins.

## 11. Risks and technical debt

- Legacy catalog and stream sources may be unavailable, unsuitable, or legally unusable.
- Exposed legacy credentials require operational review; they must never enter UTA-VERSE.
- The old database shape duplicates metadata and lacks normalized catalog/history entities.
- Whole-collection playlist sync is unsafe under concurrent edits.
- Browser autoplay, CORS, Media Session support, storage quotas, and background behavior vary by browser.
- Offline audio may require licensing and content protection decisions.
- Artist/album pages are new product surfaces, not recovered implementations.
- Crossfade is not a simple browser feature with one audio element and should remain deferred.
- Provider duration, artwork, and playback source may disagree; the product needs a source-of-truth policy.
- Large effects can compete with playback usability and mobile performance.
- A monolithic player store would recreate the old coupling and make failure handling difficult.

## 12. Decisions requiring product-owner approval

1. What catalog/content provider is approved for production, and does UTA-VERSE own or license the catalog?
2. Is the legacy iTunes + YouTube/Render path allowed for development-only discovery/playback, or must a replacement be selected first?
3. Are artist and album pages required for the first release, and what source supplies stable identities?
4. Should playback history be account-synced, device-local, or both? What retention/deletion policy applies?
5. Is browser offline/download support a required feature? If yes, what licensing, quota, and protected-content constraints apply?
6. Which auth methods are required beyond email/password: verification, reset, OAuth, or magic link?
7. Should queue and playback preferences survive refresh and sign-in changes?
8. Is crossfade a required feature or a later enhancement?
9. What playback quality options are genuinely supported by the approved source?
10. What visual intensity and mobile fallback are acceptable for Ballpit on Home?

## Scope completed in Phase 1

Created this blueprint only. No authentication, database schema, catalog, audio
engine, UI surface, React Bits component, dependency, or major product feature
was implemented.
