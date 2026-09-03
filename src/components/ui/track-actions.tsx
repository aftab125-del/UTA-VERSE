"use client";

import { useCallback, useState } from "react";
import { useUser } from "@/app/library/components/use-library";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Track } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";

interface LikeButtonProps {
  trackId: string;
  size?: "small" | "normal";
}

export function LikeButton({ trackId, size = "normal" }: LikeButtonProps) {
  const { user } = useUser();
  const [isLiked, setIsLiked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const supabase = createSupabaseBrowserClient();

  // Load initial state
  if (user && !loaded) {
    setLoaded(true);
    supabase
      .from("liked_tracks")
      .select("track_id")
      .eq("user_id", user.id)
      .eq("track_id", trackId)
      .maybeSingle()
      .then(({ data }) => setIsLiked(data !== null));
  }

  const toggle = useCallback(async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    try {
      if (wasLiked) {
        await supabase
          .from("liked_tracks")
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", trackId);
      } else {
        await supabase
          .from("liked_tracks")
          .insert({ user_id: user.id, track_id: trackId });
      }
    } catch {
      setIsLiked(wasLiked);
    }
  }, [user, isLiked, trackId, supabase]);

  if (!user) return null;

  return (
    <button
      type="button"
      className={`like-button${isLiked ? " like-button--liked" : ""}${size === "small" ? " like-button--small" : ""}`}
      onClick={(e) => { e.stopPropagation(); void toggle(); }}
      aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
    >
      {isLiked ? "♥" : "♡"}
    </button>
  );
}

interface AddToPlaylistButtonProps {
  track: Track;
}

export function AddToPlaylistButton({ track }: AddToPlaylistButtonProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const loadPlaylists = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("playlists")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPlaylists(data ?? []);
  }, [user, supabase]);

  function openModal() {
    void loadPlaylists();
    setOpen(true);
  }

  async function addToPlaylist(playlistId: string, playlistName: string) {
    // Get current max position
    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    await supabase
      .from("playlist_tracks")
      .upsert({ playlist_id: playlistId, track_id: track.id, position }, { onConflict: "playlist_id,track_id" });
    setToast(`Added to ${playlistName}`);
    setOpen(false);
    setTimeout(() => setToast(null), 2500);
  }

  async function createAndAdd() {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data: playlist } = await supabase
      .from("playlists")
      .insert({ user_id: user.id, name: newName.trim() })
      .select("id, name")
      .single();
    if (playlist) {
      await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: playlist.id, track_id: track.id, position: 0 });
      setToast(`Created "${playlist.name}" and added track`);
      setOpen(false);
      setNewName("");
    }
    setCreating(false);
    setTimeout(() => setToast(null), 2500);
  }

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className="add-to-playlist-button"
        onClick={(e) => { e.stopPropagation(); openModal(); }}
        aria-label="Add to playlist"
      >
        +
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-label="Add to playlist" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <h3>Add to playlist</h3>
              <button type="button" className="modal-card__close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-card__body">
              <div className="playlist-picker__new">
                <input
                  type="text"
                  placeholder="New playlist name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void createAndAdd(); }}
                />
                <button type="button" onClick={() => void createAndAdd()} disabled={creating || !newName.trim()}>
                  Create
                </button>
              </div>
              <div className="playlist-picker__list">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    className="playlist-picker__item"
                    onClick={() => void addToPlaylist(pl.id, pl.name)}
                  >
                    {pl.name}
                  </button>
                ))}
                {playlists.length === 0 && (
                  <p className="playlist-picker__empty">No playlists yet. Create one above.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
