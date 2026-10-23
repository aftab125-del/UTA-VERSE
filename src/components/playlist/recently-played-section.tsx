"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { dbGetRecentlyPlayed } from "@/lib/storage/client-db";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { TrackActions } from "@/components/ui/track-actions";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";

export function RecentlyPlayedSection() {
  const { user } = useUser();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = tracks === null && !error;
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      // 1. Primary: Load instantly from local IndexedDB
      try {
        const localHistory = await dbGetRecentlyPlayed(50);
        if (!cancelled && localHistory.length > 0) {
          setTracks(localHistory);
        }
      } catch {
        // ignore
      }

      // 2. Secondary: If user is signed into Supabase, merge cloud history
      if (user) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: history } = await supabase
            .from("listening_history")
            .select("track_id, title, artist, artwork, duration, played_at")
            .eq("user_id", user.id)
            .order("played_at", { ascending: false })
            .limit(100);

          if (!cancelled && history && history.length > 0) {
            const seen = new Set((tracks ?? []).map((t) => t.id));
            const merged = [...(tracks ?? [])];
            for (const row of history) {
              if (!seen.has(row.track_id)) {
                seen.add(row.track_id);
                const rawId = row.track_id || "";
                const videoId = rawId.startsWith("youtube:")
                  ? rawId.replace(/^youtube:/, "")
                  : /^[A-Za-z0-9_-]{11}$/.test(rawId)
                  ? rawId
                  : undefined;
                merged.push({
                  id: row.track_id,
                  videoId,
                  title: row.title || "Untitled",
                  artist: row.artist || "Unknown artist",
                  album: "",
                  artwork: row.artwork,
                  duration: row.duration,
                });
              }
            }
            setTracks(merged);
          }
        } catch {
          // Cloud Supabase restricted or offline; local IndexedDB persists
        }
      }

      if (!cancelled && tracks === null) {
        setTracks([]);
      }
    }

    loadHistory();

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
          ↻
        </span>
        <h2>No listening history yet</h2>
        <p>Tracks you play will show up here automatically.</p>
      </div>
    );

  function playAll() {
    if (displayTracks.length > 0) void setTrack(displayTracks[0], displayTracks);
  }

  return (
    <div className="recently-played">
      <div className="recently-played__header">
        <h2>Recently Played</h2>
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
