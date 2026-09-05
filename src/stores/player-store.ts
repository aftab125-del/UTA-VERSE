import { create } from "zustand";
import { AudioEngine } from "@/lib/audio/audio-engine";
import { setMediaSessionMetadata, setMediaSessionActionHandlers, setMediaSessionPlaybackState } from "@/lib/audio/media-session";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { recordListeningHistory } from "@/lib/music/library";
import type { Track } from "@/types/music";

export type RepeatMode = "off" | "all" | "one";

// ── localStorage persistence ──────────────────────────────────────────────────

const STORAGE_KEY = "uta-verse-player";

interface PersistedPlayerState {
  queue: Track[];
  queueIndex: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
}

function loadPersistedState(): Partial<PersistedPlayerState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerState>;
    if (!Array.isArray(parsed.queue)) parsed.queue = [];
    if (typeof parsed.volume !== "number") parsed.volume = 0.8;
    if (typeof parsed.isMuted !== "boolean") parsed.isMuted = false;
    if (!["off", "all", "one"].includes(parsed.repeatMode as string)) parsed.repeatMode = "off";
    if (typeof parsed.isShuffled !== "boolean") parsed.isShuffled = false;
    return parsed;
  } catch {
    return {};
  }
}

function savePersistedState(state: PersistedPlayerState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      queue: state.queue,
      queueIndex: state.queueIndex,
      volume: state.volume,
      isMuted: state.isMuted,
      repeatMode: state.repeatMode,
      isShuffled: state.isShuffled,
    }));
  } catch {
    // localStorage quota exceeded or unavailable — silently ignore.
  }
}

// ── Shuffle utility ───────────────────────────────────────────────────────────

function fisherYatesShuffle(arr: Track[]): Track[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Store ─────────────────────────────────────────────────────────────────────

type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  /** Snapshot of queue before shuffle was applied — used to restore original order. */
  preShuffleQueue: Track[] | null;
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
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;
};

let audioEngine: AudioEngine | null = null;
let playbackRequestId = 0;
const resolvedSourceCache = new Map<string, string>();
const historyCooldown = new Map<string, number>();

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

  const maxAttempts = 45;
  let videoIdOverride = track.videoId;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch("/api/playback/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: track.title, artist: track.artist, videoId: videoIdOverride }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      status?: unknown;
      sourceUrl?: unknown;
      videoId?: unknown;
      error?: unknown;
    };

    if (typeof data.videoId === "string" && data.videoId) {
      videoIdOverride = data.videoId;
    }

    if (response.ok && typeof data.sourceUrl === "string" && data.sourceUrl) {
      resolvedSourceCache.set(track.id, data.sourceUrl);
      return data.sourceUrl;
    }

    if (response.status === 202 || data.status === "processing") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    throw new Error(typeof data.error === "string" ? data.error : "The playback source could not be resolved.");
  }

  throw new Error("Playback resolution timed out after 90 seconds.");
}

function isCurrentRequest(requestId: number, track: Track, get: () => PlayerState) {
  return requestId === playbackRequestId && get().currentTrack?.id === track.id;
}

async function recordHistory(trackId: string, meta: { title: string; artist: string; artwork: string; duration: number }) {
  const now = Date.now();
  const lastRecorded = historyCooldown.get(trackId) ?? 0;
  if (now - lastRecorded < 30_000) return;
  historyCooldown.set(trackId, now);
  try {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await recordListeningHistory(user.id, trackId, meta, 0, supabase);
  } catch (err) {
    console.error("[PlayerStore] Failed to record listening history", { trackId, err });
  }
}

function persist(get: () => PlayerState) {
  const s = get();
  savePersistedState({
    queue: s.queue,
    queueIndex: s.queueIndex,
    volume: s.volume,
    isMuted: s.isMuted,
    repeatMode: s.repeatMode,
    isShuffled: s.isShuffled,
  });
}

const persisted = typeof window !== "undefined" ? loadPersistedState() : {};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: persisted.queue ?? [],
  queueIndex: persisted.queueIndex ?? -1,
  preShuffleQueue: null,
  isPlaying: false,
  isLoading: false,
  isResolving: false,
  position: 0,
  duration: 0,
  buffered: 0,
  volume: persisted.volume ?? 0.8,
  isMuted: persisted.isMuted ?? false,
  repeatMode: persisted.repeatMode ?? "off",
  isShuffled: persisted.isShuffled ?? false,
  error: null,

  setTrack: async (track, queue = [track]) => {
    const requestId = ++playbackRequestId;
    const queueIndex = Math.max(0, queue.findIndex((item) => item.id === track.id));
    audioEngine?.clear();
    set({ currentTrack: track, queue, queueIndex, preShuffleQueue: null, position: 0, duration: track.duration, buffered: 0, isPlaying: false, isLoading: true, isResolving: !track.audioUrl, error: null });
    persist(get);

    // Update Media Session metadata for system-level display.
    setMediaSessionMetadata(track);
    setMediaSessionPlaybackState("paused");

    try {
      const sourceUrl = track.audioUrl ?? await resolveTrackSource(track);
      if (!isCurrentRequest(requestId, track, get)) return;

      const engine = getAudioEngine();
      engine.load(sourceUrl, {
        onLoading: () => set({ isLoading: true, isResolving: false, error: null }),
        onReady: (duration) => set({ duration, isLoading: false, isResolving: false }),
        onProgress: (position, duration, buffered) => set({ position, duration, buffered }),
        onPlaying: () => { set({ isPlaying: true, isLoading: false, isResolving: false, error: null }); setMediaSessionPlaybackState("playing"); void recordHistory(track.id, { title: track.title, artist: track.artist, artwork: track.artwork, duration: track.duration }); },
        onPaused: () => { set({ isPlaying: false }); setMediaSessionPlaybackState("paused"); },
        onEnded: () => {
          const { repeatMode } = get();
          if (repeatMode === "one") {
            // Replay the current track from the beginning.
            const engine = getAudioEngine();
            engine.seek(0);
            void engine.play();
          } else {
            get().next();
          }
        },
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
    persist(get);
  },
  toggleMute: () => {
    const muted = !get().isMuted;
    set({ isMuted: muted });
    audioEngine?.setVolume(muted ? 0 : get().volume);
    persist(get);
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

  setRepeatMode: (repeatMode) => { set({ repeatMode }); persist(get); },

  setShuffled: (isShuffled) => {
    const { queue, queueIndex, currentTrack, preShuffleQueue } = get();
    if (isShuffled) {
      // Shuffle the remaining tracks (everything after current), then prepend current.
      const current = currentTrack ? [currentTrack] : [];
      const before = queue.slice(0, queueIndex);
      const after = queue.slice(queueIndex + 1);
      const shuffled = fisherYatesShuffle([...before, ...after]);
      const newQueue = [...current, ...shuffled];
      set({
        isShuffled: true,
        preShuffleQueue: queue,
        queue: newQueue,
        queueIndex: 0,
      });
    } else {
      // Restore original order, but find where current track ended up.
      const restored = preShuffleQueue ?? queue;
      const newIdx = currentTrack ? restored.findIndex((t) => t.id === currentTrack.id) : 0;
      set({
        isShuffled: false,
        preShuffleQueue: null,
        queue: restored,
        queueIndex: newIdx >= 0 ? newIdx : 0,
      });
    }
    persist(get);
  },

  // ── Queue management ──────────────────────────────────────────────────────

  addToQueue: (track) => {
    const { queue } = get();
    const existingIndex = queue.findIndex((t) => t.id === track.id);
    const newQueue = existingIndex >= 0 ? [...queue.slice(0, existingIndex), ...queue.slice(existingIndex + 1), track] : [...queue, track];
    set({ queue: newQueue });
    persist(get);
  },

  playNext: (track) => {
    const { queue, queueIndex } = get();
    const newQueue = [...queue];
    newQueue.splice(queueIndex + 1, 0, track);
    set({ queue: newQueue });
    persist(get);
  },

  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const newQueue = queue.filter((_, i) => i !== index);
    // Adjust queueIndex if the removed item was before or at the current index.
    let newQueueIndex = queueIndex;
    if (index < queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (index === queueIndex) {
      // Removed the currently playing track — keep index pointing at the next track.
      newQueueIndex = Math.min(queueIndex, newQueue.length - 1);
    }
    set({ queue: newQueue, queueIndex: newQueueIndex });
    persist(get);
  },

  reorderQueue: (from, to) => {
    const { queue, queueIndex } = get();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, moved);
    // Track where the current song moved to.
    let newQueueIndex = queueIndex;
    if (from === queueIndex) {
      newQueueIndex = to;
    } else if (from < queueIndex && to >= queueIndex) {
      newQueueIndex = queueIndex - 1;
    } else if (from > queueIndex && to <= queueIndex) {
      newQueueIndex = queueIndex + 1;
    }
    set({ queue: newQueue, queueIndex: newQueueIndex });
    persist(get);
  },

  clearQueue: () => {
    const { currentTrack, queueIndex } = get();
    // Keep the currently playing track as the only item in the queue.
    if (currentTrack && queueIndex >= 0) {
      set({ queue: [currentTrack], queueIndex: 0 });
    } else {
      set({ queue: [], queueIndex: -1 });
    }
    persist(get);
  },
}));

// ── Media Session action handlers ─────────────────────────────────────────────
// Registered once after the store is created. They read from the store directly
// so they always reflect the latest state.
if (typeof window !== "undefined") {
  setMediaSessionActionHandlers({
    play: () => { void usePlayerStore.getState().togglePlayPause(); },
    pause: () => { usePlayerStore.getState().pause(); },
    seekBackward: () => {
      const { position, seek } = usePlayerStore.getState();
      seek(Math.max(0, position - 10));
    },
    seekForward: () => {
      const { position, duration, seek } = usePlayerStore.getState();
      seek(Math.min(duration, position + 10));
    },
    previousTrack: () => { usePlayerStore.getState().previous(); },
    nextTrack: () => { usePlayerStore.getState().next(); },
  });
}
