# UTA-VERSE engineering guide

## Purpose

UTA-VERSE is a web-first, premium music platform: “a universe of music.” This repository is a new application, not a React Native or Expo port of NebulaMusic.

## Stack

Next.js App Router, React, TypeScript, Supabase, Zustand where client-global state is justified, and browser-native HTML5 Audio/Media Session APIs. Tailwind may be introduced when the visual foundation begins. Add dependencies only when a concrete feature needs them.

## Architecture rules

- Keep route composition, presentation, business logic, data access, and browser services separate.
- Keep audio orchestration behind `src/lib/audio`; do not place `Audio` or Media Session setup in page components.
- Keep Supabase access behind `src/lib/supabase` and feature data boundaries.
- Keep global state small and domain-focused.
- Prefer server components by default; add client boundaries only for interaction or browser APIs.
- Do not turn pages into monoliths.

## Browser and dependency guardrails

Browser globals must be accessed only in client code or browser-only service constructors, with cleanup for listeners, media, and animation loops. Respect reduced motion and keep visual effects from competing with playback. Do not add React Native, React Native Web, Expo native modules, `react-native-track-player`, `expo-secure-store`, or `expo-file-system`.

React Bits components are integrated one at a time, kept reusable and replaceable, and must be checked for lifecycle, performance, accessibility, and reduced-motion behavior. Ballpit is the first approved React Bits component and is restricted to the Home atmospheric background; do not add additional React Bits components without an explicitly scoped visual-foundation task.

## Product and design principles

Build a dark, cinematic, futuristic, atmospheric, premium experience with its own identity. Spotify is a quality reference, not a visual template. Usability, accessibility, responsive mobile web behavior, and playback reliability take priority over decorative effects.

## Conventions

Use strict TypeScript, descriptive names, small focused modules, accessible semantic HTML, and explicit error handling. Keep secrets in environment variables. Update architecture documentation when boundaries change.

## Commands

```text
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Safe change workflow

Inspect existing code and docs first, preserve unrelated work, implement the smallest coherent boundary, run typecheck/lint/build as applicable, and report what was actually verified. Do not invent recovered NebulaMusic behavior; document unavailable evidence and product decisions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
