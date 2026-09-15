import type { Track } from "@/types/music";

/**
 * Media Session API integration — provides system-level playback controls
 * (OS media overlay, headphone buttons, lock screen) and metadata display.
 *
 * Safe to call from any context — all browser API access is guarded.
 */

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

export function setMediaSessionMetadata(track: Track) {
  if (!isMediaSessionSupported()) return;

  const artwork = track.artwork
    ? [
        { src: track.artwork, sizes: "96x96", type: "image/jpeg" },
        { src: track.artwork, sizes: "128x128", type: "image/jpeg" },
        { src: track.artwork, sizes: "192x192", type: "image/jpeg" },
        { src: track.artwork, sizes: "256x256", type: "image/jpeg" },
        { src: track.artwork, sizes: "384x384", type: "image/jpeg" },
        { src: track.artwork, sizes: "512x512", type: "image/jpeg" },
      ]
    : [];

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || "UTA-VERSE",
      artwork,
    });
  } catch {
    // If MediaMetadata constructor fails on some browsers, fail gracefully.
  }
}

export function setMediaSessionActionHandlers(handlers: {
  play: () => void;
  pause: () => void;
  stop?: () => void;
  seekBackward?: (details: MediaSessionActionDetails) => void;
  seekForward?: (details: MediaSessionActionDetails) => void;
  seekTo?: (details: MediaSessionActionDetails) => void;
  previousTrack?: () => void;
  nextTrack?: () => void;
}) {
  if (!isMediaSessionSupported()) return;

  const actions: Array<[MediaSessionAction, ((details: MediaSessionActionDetails) => void) | null]> = [
    ["play", handlers.play],
    ["pause", handlers.pause],
    ["stop", handlers.stop ?? null],
    ["seekbackward", handlers.seekBackward ?? null],
    ["seekforward", handlers.seekForward ?? null],
    ["seekto", handlers.seekTo ?? null],
    ["previoustrack", handlers.previousTrack ?? null],
    ["nexttrack", handlers.nextTrack ?? null],
  ];

  for (const [action, handler] of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Individual action might be unsupported on older browser builds — silently ignore each individually.
    }
  }
}

export function updateMediaSessionPositionState(state: {
  duration: number;
  playbackRate?: number;
  position: number;
}) {
  if (!isMediaSessionSupported() || !("setPositionState" in navigator.mediaSession)) return;

  try {
    const duration = Number.isFinite(state.duration) && state.duration > 0 ? state.duration : 0;
    if (duration > 0) {
      const position = Number.isFinite(state.position) ? Math.max(0, Math.min(duration, state.position)) : 0;
      const playbackRate = Number.isFinite(state.playbackRate) && state.playbackRate! > 0 ? state.playbackRate : 1;
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position,
      });
    }
  } catch {
    // Position state updates may throw if duration/position is invalid during transitions — ignore safely.
  }
}

export function setMediaSessionPlaybackState(state: "playing" | "paused" | "none") {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    // Silently ignore
  }
}

export function clearMediaSession() {
  if (!isMediaSessionSupported()) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
    if ("setPositionState" in navigator.mediaSession) {
      navigator.mediaSession.setPositionState();
    }
  } catch {
    // Silently ignore
  }
}
