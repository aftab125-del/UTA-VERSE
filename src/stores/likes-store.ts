import { create } from "zustand";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toggleLikeTrack } from "@/lib/music/library";
import { dbGetLikedTrackIds, dbToggleLikeTrack } from "@/lib/storage/client-db";
import type { Track } from "@/types/music";

interface LikesState {
  likedTrackIds: Set<string>;
  initializedUserId: string | null;
  isLoading: boolean;
  init: (userId?: string) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (userId: string, track: Track) => Promise<boolean>;
  reset: () => void;
}

export const useLikesStore = create<LikesState>((set, get) => ({
  likedTrackIds: new Set<string>(),
  initializedUserId: null,
  isLoading: false,

  init: async (userId?: string) => {
    const effectiveId = userId || "local-user";
    if (get().initializedUserId === effectiveId && get().likedTrackIds.size > 0) return;
    set({ isLoading: true });

    // 1. Primary: Load instantly from local IndexedDB (Echo Music client-first architecture)
    try {
      const localIds = await dbGetLikedTrackIds();
      if (localIds.size > 0) {
        set({ likedTrackIds: localIds, initializedUserId: effectiveId, isLoading: false });
      }
    } catch {
      // ignore
    }

    // 2. Secondary: If cloud Supabase is configured and not restricted, sync cloud likes
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("liked_tracks")
        .select("track_id")
        .eq("user_id", effectiveId);

      if (!error && Array.isArray(data)) {
        const idSet = new Set<string>(get().likedTrackIds);
        data.forEach((row) => idSet.add(row.track_id));
        set({ likedTrackIds: idSet, initializedUserId: effectiveId, isLoading: false });
        return;
      }
    } catch {
      // Cloud Supabase unavailable or restricted; local DB is active
    }

    set({ initializedUserId: effectiveId, isLoading: false });
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

    // 1. Save to local IndexedDB (Always succeeds, 0 quota)
    let localResult = !wasLiked;
    try {
      localResult = await dbToggleLikeTrack(track.id, {
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
      });
    } catch (dbErr) {
      console.warn("[LikesStore] Local DB write error:", dbErr);
    }

    // 2. Best-effort background sync to Supabase (silently catches quota/network errors)
    if (userId && userId !== "local-user") {
      try {
        const supabase = createSupabaseBrowserClient();
        await toggleLikeTrack(
          userId,
          track.id,
          {
            title: track.title,
            artist: track.artist,
            artwork: track.artwork,
            duration: track.duration,
          },
          supabase
        );
      } catch {
        // Supabase storage or API restricted; local IndexedDB persists state reliably
      }
    }

    return localResult;
  },

  reset: () => {
    set({ likedTrackIds: new Set<string>(), initializedUserId: null, isLoading: false });
  },
}));
