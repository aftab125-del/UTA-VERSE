"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Track } from "@/types/music";

interface LikeButtonProps {
  track: Track;
  size?: "small" | "normal";
}

export function LikeButton({ track, size = "normal" }: LikeButtonProps) {
  const { user } = useUser();
  const [isLiked, setIsLiked] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("liked_tracks")
      .select("track_id")
      .eq("user_id", user.id)
      .eq("track_id", track.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("[LikeButton]", error.message); return; }
        setIsLiked(data !== null);
      });
    return () => { cancelled = true; };
  }, [user, track.id, supabase]);

  const toggle = useCallback(async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("liked_tracks")
          .delete()
          .eq("user_id", user.id)
          .eq("track_id", track.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("liked_tracks")
          .insert({
            user_id: user.id,
            track_id: track.id,
            title: track.title,
            artist: track.artist,
            artwork: track.artwork,
            duration: track.duration,
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error("[LikeButton] toggle failed", err);
      setIsLiked(wasLiked);
    }
  }, [user, isLiked, track, supabase]);

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
    const { data, error } = await supabase
      .from("playlists")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) { console.error("[AddToPlaylist]", error.message); return; }
    setPlaylists(data ?? []);
  }, [user, supabase]);

  function openModal() {
    void loadPlaylists();
    setOpen(true);
  }

  async function addToPlaylist(playlistId: string, playlistName: string) {
    const { data: existing, error: posError } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    if (posError) { console.error("[AddToPlaylist] Failed to fetch position", posError.message); return; }
    const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { error } = await supabase
      .from("playlist_tracks")
      .upsert(
        {
          playlist_id: playlistId,
          track_id: track.id,
          position,
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
          duration: track.duration,
        },
        { onConflict: "playlist_id,track_id" },
      );
    if (error) { console.error("[AddToPlaylist] insert failed", error.message); setToast(`Failed to add to ${playlistName}`); setTimeout(() => setToast(null), 3500); return; }
    setToast(`Added to ${playlistName}`);
    setOpen(false);
    setTimeout(() => setToast(null), 2500);
  }

  async function createAndAdd() {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data: playlist, error: createError } = await supabase
      .from("playlists")
      .insert({ user_id: user.id, name: newName.trim() })
      .select("id, name")
      .single();
    if (createError) { console.error("[AddToPlaylist] create failed", createError.message); setCreating(false); return; }
    if (playlist) {
      const { error: trackError } = await supabase
        .from("playlist_tracks")
        .insert({
          playlist_id: playlist.id,
          track_id: track.id,
          position: 0,
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
          duration: track.duration,
        });
      if (trackError) { console.error("[AddToPlaylist] add track failed", trackError.message); }
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
