"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { dbGetLikedTracksWithDetails } from "@/lib/storage/client-db";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { TrackActions } from "@/components/ui/track-actions";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";

export function LikedSongsSection() {
  const { user } = useUser();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = tracks === null && !error;
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    let cancelled = false;

    async function loadTracks() {
      // 1. Primary: Load instantly from local IndexedDB (Echo Music architecture)
      try {
        const localTracks = await dbGetLikedTracksWithDetails();
        if (!cancelled && localTracks.length > 0) {
          setTracks(localTracks);
        }
      } catch {
        // ignore
      }

      // 2. Secondary: If user is signed into Supabase, merge cloud likes
      if (user) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: liked } = await supabase
            .from("liked_tracks")
            .select("track_id, title, artist, artwork, duration")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (!cancelled && liked && liked.length > 0) {
            const cloudTracks: Track[] = liked.map((row) => {
              const rawId = row.track_id || "";
              const videoId = rawId.startsWith("youtube:")
                ? rawId.replace(/^youtube:/, "")
                : /^[A-Za-z0-9_-]{11}$/.test(rawId)
                ? rawId
                : undefined;
              return {
                id: row.track_id,
                videoId,
                title: row.title || "Untitled",
                artist: row.artist || "Unknown artist",
                album: "",
                artwork: row.artwork,
                duration: row.duration,
              };
            });

            setTracks((prev) => {
              const existingIds = new Set((prev ?? []).map((t) => t.id));
              const merged = [...(prev ?? [])];
              for (const ct of cloudTracks) {
                if (!existingIds.has(ct.id)) {
                  merged.push(ct);
                }
              }
              return merged;
            });
          }
        } catch {
          // Cloud Supabase restricted or unavailable; local DB continues cleanly
        }
      }

      if (!cancelled && tracks === null) {
        setTracks([]);
      }
    }

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayTracks = tracks ?? [];

  if (loading) return <div className="library-loading">Loading…</div>;
  if (error)
    return (
      <div className="empty-panel catalog-state">
        <span className="empty-panel__mark" aria-hidden="true">
          ⚠
        </span>
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  if (displayTracks.length === 0)
    return (
      <div className="empty-panel catalog-state">
        <span className="empty-panel__mark" aria-hidden="true">
          ♡
        </span>
        <h2>Songs you like will appear here</h2>
        <p>Save songs by tapping the heart icon on any track.</p>
      </div>
    );

  function playAll() {
    if (displayTracks.length > 0) void setTrack(displayTracks[0], displayTracks);
  }

  return (
    <div className="liked-songs">
      <div className="liked-songs__header">
        <div className="liked-songs__gradient" />
        <div className="liked-songs__info">
          <h2>Liked Songs</h2>
          <span>
            {displayTracks.length} song{displayTracks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button type="button" className="liked-songs__play-btn" onClick={playAll}>
          ▶ Play
        </button>
      </div>
      <div className="track-list">
        {displayTracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className={`track-item ${isCurrent ? "track-item--current" : ""}`}
              onClick={() => void setTrack(track, displayTracks)}
            >
              <span className="track-item__index">{i + 1}</span>
              <ArtworkTile
                artwork={track.artwork}
                title={track.title}
                size="small"
              />
              <div className="track-item__meta">
                <span className="track-item__title">{track.title}</span>
                <span className="track-item__artist">{track.artist}</span>
              </div>
              <span className="track-item__duration">
                {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}
              </span>
              <TrackActions track={track} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
