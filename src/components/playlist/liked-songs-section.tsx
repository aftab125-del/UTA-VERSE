"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";

export function LikedSongsSection() {
  const { user } = useUser();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: liked, error: likedError } = await supabase
        .from("liked_tracks")
        .select("track_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (likedError) {
        console.error("[LikedSongsSection] Failed to load liked tracks", likedError.message);
        setError("Failed to load liked songs.");
        setLoading(false);
        return;
      }
      if (!liked || liked.length === 0) { setTracks([]); setLoading(false); return; }

      const ids = liked.map((l) => l.track_id);
      const { data: trackRows, error: tracksError } = await supabase
        .from("tracks")
        .select("*, artists(name), albums(title, artwork_url)")
        .in("id", ids);
      if (cancelled) return;
      if (tracksError) {
        console.error("[LikedSongsSection] Failed to load tracks", tracksError.message);
        setError("Failed to load track details.");
        setLoading(false);
        return;
      }

      const trackMap = new Map((trackRows ?? []).map((t) => [t.id, t]));
      const result = ids
        .map((id) => trackMap.get(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined)
        .map((row) => {
          const r = row as Record<string, unknown> & { artists: { name: string } | null; albums: { title: string; artwork_url: string | null } | null };
          return {
            id: r.id as string,
            title: r.title as string,
            artist: (r.artists as { name: string } | null)?.name ?? "Unknown artist",
            album: (r.albums as { title: string; artwork_url: string | null } | null)?.title ?? "Unknown album",
            artwork: (r.artwork_url as string | null) ?? (r.albums as { title: string; artwork_url: string | null } | null)?.artwork_url ?? "",
            duration: r.duration as number,
            ...((r.audio_url as string | null) ? { audioUrl: r.audio_url as string } : {}),
          };
        });
      setTracks(result);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, supabase]);

  if (!user) return (
    <div className="empty-panel catalog-state">
      <span className="empty-panel__mark" aria-hidden="true">♡</span>
      <h2>Sign in to see liked songs</h2>
      <p>Liked songs are saved to your account.</p>
    </div>
  );

  if (loading) return <div className="library-loading">Loading…</div>;
  if (error) return <div className="empty-panel catalog-state"><span className="empty-panel__mark" aria-hidden="true">⚠</span><h2>Something went wrong</h2><p>{error}</p></div>;
  if (tracks.length === 0) return (
    <div className="empty-panel catalog-state">
      <span className="empty-panel__mark" aria-hidden="true">♡</span>
      <h2>Songs you like will appear here</h2>
      <p>Save songs by tapping the heart icon.</p>
    </div>
  );

  function playAll() {
    if (tracks.length > 0) void setTrack(tracks[0], tracks);
  }

  return (
    <div className="liked-songs">
      <div className="liked-songs__header">
        <div className="liked-songs__gradient" />
        <div className="liked-songs__info">
          <h2>Liked Songs</h2>
          <span>{tracks.length} song{tracks.length !== 1 ? "s" : ""}</span>
        </div>
        <button type="button" className="liked-songs__play-btn" onClick={playAll}>
          ▶ Play
        </button>
      </div>
      <div className="track-list">
        {tracks.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className={`track-card track-card--row${isCurrent ? " track-card--current" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => void setTrack(track, tracks)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void setTrack(track, tracks); } }}
            >
              <div className="track-card__position">
                {isCurrent && isPlaying ? <span className="track-card__eq" aria-hidden="true"><span /><span /><span /></span> : <span>{i + 1}</span>}
              </div>
              <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
              <div className="track-card__details">
                <h3>{track.title}</h3>
                <p>{track.artist}</p>
              </div>
              <span className="track-card__duration">{formatDuration(track.duration)}</span>
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
