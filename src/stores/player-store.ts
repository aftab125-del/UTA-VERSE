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
  position: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  error: string | null;
  setTrack: (track: Track, queue?: Track[]) => void;
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

function getAudioEngine() {
  if (!audioEngine) audioEngine = new AudioEngine();
  return audioEngine;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  buffered: 0,
  volume: 0.8,
  isMuted: false,
  repeatMode: "off",
  isShuffled: false,
  error: null,

  setTrack: (track, queue = [track]) => {
    const queueIndex = Math.max(0, queue.findIndex((item) => item.id === track.id));
    set({ currentTrack: track, queue, queueIndex, position: 0, duration: track.duration, isPlaying: false, isLoading: false, error: null });

    if (typeof window === "undefined" || !track.audioUrl) return;

    const engine = getAudioEngine();
    engine.load(track.audioUrl, {
      onLoading: () => set({ isLoading: true, error: null }),
      onReady: (duration) => set({ duration, isLoading: false }),
      onProgress: (position, duration, buffered) => set({ position, duration, buffered }),
      onPlaying: () => set({ isPlaying: true, isLoading: false }),
      onPaused: () => set({ isPlaying: false }),
      onEnded: () => get().next(),
      onError: (message) => set({ error: message, isPlaying: false, isLoading: false }),
    });
    engine.setVolume(get().isMuted ? 0 : get().volume);
  },

  togglePlayPause: async () => {
    const track = get().currentTrack;
    if (!track?.audioUrl) {
      set({ error: "This preview is waiting for a catalog audio source." });
      return;
    }

    const engine = getAudioEngine();
    if (get().isPlaying) {
      engine.pause();
    } else {
      try {
        await engine.play();
      } catch {
        set({ error: "Playback could not start. Check the browser audio permission." });
      }
    }
  },

  pause: () => getAudioEngine().pause(),
  seek: (position) => getAudioEngine().seek(position),
  setVolume: (volume) => {
    const nextVolume = Math.min(1, Math.max(0, volume));
    set({ volume: nextVolume, isMuted: nextVolume === 0 });
    if (typeof window !== "undefined") getAudioEngine().setVolume(nextVolume);
  },
  toggleMute: () => {
    const muted = !get().isMuted;
    set({ isMuted: muted });
    if (typeof window !== "undefined") getAudioEngine().setVolume(muted ? 0 : get().volume);
  },
  next: () => {
    const { queue, queueIndex, repeatMode } = get();
    if (!queue.length) return;
    const nextIndex = queueIndex + 1 >= queue.length ? (repeatMode === "all" ? 0 : -1) : queueIndex + 1;
    if (nextIndex === -1) {
      getAudioEngine().pause();
      set({ isPlaying: false });
      return;
    }
    get().setTrack(queue[nextIndex], queue);
  },
  previous: () => {
    const { queue, queueIndex } = get();
    if (queue.length && queueIndex > 0) get().setTrack(queue[queueIndex - 1], queue);
  },
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  setShuffled: (isShuffled) => set({ isShuffled }),
}));
