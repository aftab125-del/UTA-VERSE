"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { user, loading };
}

export function useLikedTracks(trackIds: string[]) {
  const { user } = useUser();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!user || trackIds.length === 0) {
      setLikedIds(new Set());
      return;
    }
    setLoading(true);
    supabase
      .from("liked_tracks")
      .select("track_id")
      .eq("user_id", user.id)
      .in("track_id", trackIds)
      .then(({ data }) => {
        setLikedIds(new Set(data?.map((r) => r.track_id) ?? []));
        setLoading(false);
      });
  }, [user, trackIds.join(","), supabase]);

  const toggle = useCallback(
    async (trackId: string) => {
      if (!user) return;
      const wasLiked = likedIds.has(trackId);
      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
      try {
        if (wasLiked) {
          const { error } = await supabase
            .from("liked_tracks")
            .delete()
            .eq("user_id", user.id)
            .eq("track_id", trackId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("liked_tracks")
            .insert({ user_id: user.id, track_id: trackId });
          if (error) throw error;
        }
      } catch {
        // Revert on error
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(trackId);
          else next.delete(trackId);
          return next;
        });
      }
    },
    [user, likedIds, supabase],
  );

  return { likedIds, toggle, loading };
}
