import { create } from "zustand";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toggleLikeTrack } from "@/lib/music/library";
import type { Track } from "@/types/music";

interface LikesState {
  likedTrackIds: Set<string>;
  initializedUserId: string | null;
  isLoading: boolean;
  init: (userId: string) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (userId: string, track: Track) => Promise<boolean>;
  reset: () => void;
}

export const useLikesStore = create<LikesState>((set, get) => ({
  likedTrackIds: new Set<string>(),
  initializedUserId: null,
  isLoading: false,

  init: async (userId: string) => {
    if (get().initializedUserId === userId || get().isLoading) return;
    set({ isLoading: true });
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("liked_tracks")
        .select("track_id")
        .eq("user_id", userId);

      if (error) {
        console.error("[LikesStore] Failed to load liked tracks", error);
        set({ isLoading: false });
        return;
      }

      const idSet = new Set<string>((data ?? []).map((row) => row.track_id));
      set({ likedTrackIds: idSet, initializedUserId: userId, isLoading: false });
    } catch (err) {
      console.error("[LikesStore] Error initializing likes", err);
      set({ isLoading: false });
    }
  },

  isLiked: (trackId: string) => {
    return get().likedTrackIds.has(trackId);
  },

  toggleLike: async (userId: string, track: Track) => {
    const { likedTrackIds } = get();
    const wasLiked = likedTrackIds.has(track.id);
    const nextSet = new Set(likedTrackIds);

    if (wasLiked) {
      nextSet.delete(track.id);
    } else {
      nextSet.add(track.id);
    }

    // Optimistic update
    set({ likedTrackIds: nextSet });

    try {
      const supabase = createSupabaseBrowserClient();
      const nowLiked = await toggleLikeTrack(
        userId,
        track.id,
        {
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
          duration: track.duration,
        },
        supabase,
      );

      // Align state with backend confirmation
      const confirmedSet = new Set(get().likedTrackIds);
      if (nowLiked) {
        confirmedSet.add(track.id);
      } else {
        confirmedSet.delete(track.id);
      }
      set({ likedTrackIds: confirmedSet });
      return nowLiked;
    } catch (err) {
      console.error("[LikesStore] Failed to toggle like", err);
      // Rollback
      set({ likedTrackIds });
      throw err;
    }
  },

  reset: () => {
    set({ likedTrackIds: new Set<string>(), initializedUserId: null, isLoading: false });
  },
}));
