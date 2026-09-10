"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { TrackActions } from "@/components/ui/track-actions";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";

export function RecentlyPlayedSection() {
  const { user } = useUser();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = Boolean(user) && tracks === null && !error;
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: history, error: historyError } = await supabase
        .from("listening_history")
        .select("track_id, title, artist, artwork, duration, played_at")
        .eq("user_id", user.id)
        .order("played_at", { ascending: false })
        .limit(150);
      if (cancelled) return;
      if (historyError) {
        console.error("[RecentlyPlayedSection] Failed to load history", historyError.message);
        setError("Failed to load listening history.");
        setTracks([]);
        return;
      }
      if (!history || history.length === 0) { setTracks([]); return; }

      // Deduplicate by track_id, keeping the most recent entry
      const seen = new Set<string>();
      const result: Track[] = [];
      for (const row of history) {
        if (!seen.has(row.track_id)) {
          seen.add(row.track_id);
          const rawId = row.track_id || "";
          const videoId = rawId.startsWith("youtube:")
            ? rawId.replace(/^youtube:/, "")
            : /^[A-Za-z0-9_-]{11}$/.test(rawId)
            ? rawId
            : undefined;
          result.push({
            id: row.track_id,
            videoId,
            title: row.title || "Untitled",
            artist: row.artist || "Unknown artist",
            album: "",
            artwork: row.artwork,
            duration: row.duration,
          });
        }
        if (result.length >= 50) break;
      }
      setTracks(result);
    })();
    return () => { cancelled = true; };
  }, [user, supabase]);

  if (!user) return (
    <div className="empty-panel catalog-state">
      <span className="empty-panel__mark" aria-hidden="true">↻</span>
      <h2>Sign in to see listening history</h2>
      <p>Tracks you play will show up here.</p>
    </div>
  );

  const displayTracks = tracks ?? [];

  if (loading) return <div className="library-loading">Loading…</div>;
  if (error) return <div className="empty-panel catalog-state"><span className="empty-panel__mark" aria-hidden="true">⚠</span><h2>Something went wrong</h2><p>{error}</p></div>;
  if (displayTracks.length === 0) return (
    <div className="empty-panel catalog-state">
      <span className="empty-panel__mark" aria-hidden="true">↻</span>
      <h2>No listening history yet</h2>
      <p>Tracks you play will show up here.</p>
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
              className={`track-card track-card--row${isCurrent ? " track-card--current" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => void setTrack(track, displayTracks)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void setTrack(track, displayTracks); } }}
            >
              <div className="track-card__position">
                {isCurrent && isPlaying ? <span className="track-card__eq" aria-hidden="true"><span /><span /><span /></span> : <span>{i + 1}</span>}
              </div>
              <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
              <div className="track-card__details">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
              <div className="track-card__actions" onClick={(e) => e.stopPropagation()}>
                <TrackActions track={track} size="small" variant="row" />
                <span className="track-card__duration">{formatDuration(track.duration)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
