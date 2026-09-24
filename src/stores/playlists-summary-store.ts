import { create } from "zustand";
import { getUserPlaylistsSummary, type PlaylistSummary } from "@/lib/music/playlists";

interface PlaylistsSummaryState {
  playlists: PlaylistSummary[];
  loadedUserId: string | null;
  isLoading: boolean;
  load: (userId: string, force?: boolean) => Promise<void>;
  addPlaylist: (playlist: PlaylistSummary) => void;
  incrementTrackCount: (playlistId: string) => void;
  reset: () => void;
}

export const usePlaylistsSummaryStore = create<PlaylistsSummaryState>((set, get) => ({
  playlists: [],
  loadedUserId: null,
  isLoading: false,

  load: async (userId: string, force = false) => {
    // If already loaded for this user and not forcing a refresh, keep current playlists
    if (!force && get().loadedUserId === userId && get().playlists.length > 0) {
      // Revalidate in background silently
      getUserPlaylistsSummary(userId)
        .then((data) => set({ playlists: data }))
        .catch(() => {});
      return;
    }

    set({ isLoading: get().playlists.length === 0 });
    try {
      const data = await getUserPlaylistsSummary(userId);
      set({ playlists: data, loadedUserId: userId, isLoading: false });
    } catch (err) {
      console.error("[PlaylistsSummaryStore] Load failed", err);
      set({ isLoading: false });
    }
  },

  addPlaylist: (playlist: PlaylistSummary) => {
    set((state) => ({ playlists: [playlist, ...state.playlists] }));
  },

  incrementTrackCount: (playlistId: string) => {
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p
      ),
    }));
  },

  reset: () => set({ playlists: [], loadedUserId: null, isLoading: false }),
}));
