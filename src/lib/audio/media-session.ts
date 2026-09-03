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
    ? [{ src: track.artwork, sizes: "512x512", type: "image/jpeg" }]
    : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork,
  });
}

export function setMediaSessionActionHandlers(handlers: {
  play: () => void;
  pause: () => void;
  seekBackward?: () => void;
  seekForward?: () => void;
  previousTrack?: () => void;
  nextTrack?: () => void;
}) {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.setActionHandler("play", handlers.play);
    navigator.mediaSession.setActionHandler("pause", handlers.pause);
    navigator.mediaSession.setActionHandler("seekbackward", handlers.seekBackward ?? null);
    navigator.mediaSession.setActionHandler("seekforward", handlers.seekForward ?? null);
    navigator.mediaSession.setActionHandler("previoustrack", handlers.previousTrack ?? null);
    navigator.mediaSession.setActionHandler("nexttrack", handlers.nextTrack ?? null);
  } catch {
    // Some browsers throw for unsupported action handlers — silently ignore.
  }
}

export function setMediaSessionPlaybackState(state: "playing" | "paused" | "none") {
  if (!isMediaSessionSupported()) return;
  navigator.mediaSession.playbackState = state;
}

export function clearMediaSession() {
  if (!isMediaSessionSupported()) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}
