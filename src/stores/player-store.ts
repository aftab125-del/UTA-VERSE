import { create } from "zustand";
import { AudioEngine } from "@/lib/audio/audio-engine";
import type { Track } from "@/types/music";

export type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isResolving: boolean;
  position: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  error: string | null;
  setTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  next: () => void;
  previous: () => void;
  setRepeatMode: (repeatMode: RepeatMode) => void;
  setShuffled: (isShuffled: boolean) => void;
};

let audioEngine: AudioEngine | null = null;
let playbackRequestId = 0;
const resolvedSourceCache = new Map<string, string>();

function getAudioEngine() {
  if (!audioEngine) audioEngine = new AudioEngine();
  return audioEngine;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function resolveTrackSource(track: Track): Promise<string> {
  const cachedSource = resolvedSourceCache.get(track.id);
  if (cachedSource) return cachedSource;
  const response = await fetch("/api/playback/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: track.title, artist: track.artist, videoId: track.videoId }),
  });
  const data = (await response.json()) as { sourceUrl?: unknown; error?: unknown };
  console.info("[PlayerStore] Playback resolver response", {
    status: response.status,
    ok: response.ok,
    hasSourceUrl: typeof data.sourceUrl === "string" && data.sourceUrl.length > 0,
    error: typeof data.error === "string" ? data.error : null,
  });
  if (!response.ok || typeof data.sourceUrl !== "string" || !data.sourceUrl) {
    throw new Error(typeof data.error === "string" ? data.error : "The playback source could not be resolved.");
  }
  resolvedSourceCache.set(track.id, data.sourceUrl);
  return data.sourceUrl;
}

function isCurrentRequest(requestId: number, track: Track, get: () => PlayerState) {
  return requestId === playbackRequestId && get().currentTrack?.id === track.id;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isLoading: false,
  isResolving: false,
  position: 0,
  duration: 0,
  buffered: 0,
  volume: 0.8,
  isMuted: false,
  repeatMode: "off",
  isShuffled: false,
  error: null,

  setTrack: async (track, queue = [track]) => {
    const requestId = ++playbackRequestId;
    const queueIndex = Math.max(0, queue.findIndex((item) => item.id === track.id));
    audioEngine?.clear();
    set({ currentTrack: track, queue, queueIndex, position: 0, duration: track.duration, buffered: 0, isPlaying: false, isLoading: true, isResolving: !track.audioUrl, error: null });

    try {
      const sourceUrl = track.audioUrl ?? await resolveTrackSource(track);
      if (!isCurrentRequest(requestId, track, get)) return;

      const engine = getAudioEngine();
      engine.load(sourceUrl, {
        onLoading: () => set({ isLoading: true, isResolving: false, error: null }),
        onReady: (duration) => set({ duration, isLoading: false, isResolving: false }),
        onProgress: (position, duration, buffered) => set({ position, duration, buffered }),
        onPlaying: () => set({ isPlaying: true, isLoading: false, isResolving: false, error: null }),
        onPaused: () => set({ isPlaying: false }),
        onEnded: () => get().next(),
        onError: (message) => set({ error: message, isPlaying: false, isLoading: false, isResolving: false }),
      });
      engine.setVolume(get().isMuted ? 0 : get().volume);
      set({ isResolving: false });
      await engine.play();
    } catch (error) {
      if (!isCurrentRequest(requestId, track, get)) return;
      const message = getErrorMessage(error, "Playback could not start.");
      console.error("[PlayerStore] Track resolution or playback failed", { trackId: track.id, message });
      audioEngine?.clear();
      set({ error: message, isPlaying: false, isLoading: false, isResolving: false });
    }
  },

  togglePlayPause: async () => {
    const track = get().currentTrack;
    if (!track || get().isResolving || get().isLoading) return;
    if (get().isPlaying) {
      audioEngine?.pause();
      return;
    }
    await get().setTrack(track, get().queue.length ? get().queue : [track]);
  },

  pause: () => { if (!get().isResolving) audioEngine?.pause(); },
  seek: (position) => { if (!get().isResolving && !get().isLoading && get().duration > 0) audioEngine?.seek(position); },
  setVolume: (volume) => {
    const nextVolume = Math.min(1, Math.max(0, volume));
    set({ volume: nextVolume, isMuted: nextVolume === 0 });
    audioEngine?.setVolume(nextVolume);
  },
  toggleMute: () => {
    const muted = !get().isMuted;
    set({ isMuted: muted });
    audioEngine?.setVolume(muted ? 0 : get().volume);
  },
  next: () => {
    const { queue, queueIndex, repeatMode } = get();
    if (!queue.length) return;
    const nextIndex = queueIndex + 1 >= queue.length ? (repeatMode === "all" ? 0 : -1) : queueIndex + 1;
    if (nextIndex === -1) { audioEngine?.pause(); set({ isPlaying: false }); return; }
    void get().setTrack(queue[nextIndex], queue);
  },
  previous: () => {
    const { queue, queueIndex } = get();
    if (queue.length && queueIndex > 0) void get().setTrack(queue[queueIndex - 1], queue);
  },
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  setShuffled: (isShuffled) => set({ isShuffled }),
}));
