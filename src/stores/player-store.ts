import { create } from "zustand";

export type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  isPlaying: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  setPlaying: (isPlaying: boolean) => void;
  setRepeatMode: (repeatMode: RepeatMode) => void;
  setShuffled: (isShuffled: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  repeatMode: "off",
  isShuffled: false,
  setPlaying: (isPlaying) => set({ isPlaying }),
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  setShuffled: (isShuffled) => set({ isShuffled }),
}));
