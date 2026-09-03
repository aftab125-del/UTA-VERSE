"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContextMenu } from "@/components/ui/context-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PlaylistWithTracks, Track } from "@/types/music";

interface PlaylistDetailProps {
  playlist: PlaylistWithTracks;
  isOwner: boolean;
}

export function PlaylistDetail({ playlist: initial, isOwner }: PlaylistDetailProps) {
  const [playlist, setPlaylist] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const setTrack = usePlayerStore((s) => s.setTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const supabase = createSupabaseBrowserClient();

  const totalDuration = playlist.tracks.reduce((sum, t) => sum + t.duration, 0);

  function playAll() {
    if (playlist.tracks.length > 0) void setTrack(playlist.tracks[0], playlist.tracks);
  }

  function shufflePlay() {
    if (playlist.tracks.length === 0) return;
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    void setTrack(shuffled[0], shuffled);
  }

  async function handleRemoveTrack(trackId: string) {
    await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlist.id)
      .eq("track_id", trackId);
    setPlaylist((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      trackCount: prev.trackCount - 1,
    }));
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("playlists").delete().eq("id", playlist.id);
    router.push("/playlists");
  }

  function handleEdited(updated: { id: string; name: string }) {
    setPlaylist((prev) => ({ ...prev, name: updated.name }));
    setEditOpen(false);
  }

  function getTrackActions(track: Track) {
    return [
      { label: "Play next", icon: "→", onClick: () => playNext(track) },
      { label: "Add to queue", icon: "≡", onClick: () => addToQueue(track) },
      ...(isOwner ? [{ label: "Remove from playlist", icon: "×", onClick: () => void handleRemoveTrack(track.id), danger: true }] : []),
    ];
  }

  return (
    <>
      <div className="detail-hero">
        <div className="playlist-detail__art">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt="" width={288} height={288} className="playlist-detail__cover-img" />
          ) : (
            <ArtworkTile artwork="" title={playlist.name} size="large" />
          )}
        </div>
        <div>
          <p className="eyebrow">Playlist</p>
          <h1 className="route-title">{playlist.name}</h1>
          {playlist.description && <p className="route-lede">{playlist.description}</p>}
          <p className="playlist-detail__meta">
            {playlist.trackCount} track{playlist.trackCount !== 1 ? "s" : ""}
            {totalDuration > 0 && <> · {formatTotalDuration(totalDuration)}</>}
          </p>
          <div className="playlist-detail__actions">
            {playlist.tracks.length > 0 && (
              <>
                <button type="button" className="liked-songs__play-btn" onClick={playAll}>▶ Play</button>
                <button type="button" className="liked-songs__play-btn playlist-detail__shuffle-btn" onClick={shufflePlay}>⇄ Shuffle</button>
              </>
            )}
            {isOwner && (
              <>
                <button type="button" className="playlist-detail__edit-btn" onClick={() => setEditOpen(true)}>Edit</button>
                <button type="button" className="playlist-detail__delete-btn" onClick={() => setDeleteOpen(true)}>Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="content-section">
        {playlist.tracks.length === 0 ? (
          <div className="empty-panel catalog-state">
            <span className="empty-panel__mark" aria-hidden="true">≡</span>
            <h2>This playlist is empty</h2>
            <p>Find songs and add them to this playlist.</p>
          </div>
        ) : (
          <div className="track-list">
            {playlist.tracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              const actions = isOwner ? getTrackActions(track) : [
                { label: "Play next", icon: "→", onClick: () => playNext(track) },
                { label: "Add to queue", icon: "≡", onClick: () => addToQueue(track) },
              ];
              return (
                <ContextMenu key={track.id} actions={actions}>
                  <div
                    className={`track-card track-card--row${isCurrent ? " track-card--current" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => void setTrack(track, playlist.tracks)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void setTrack(track, playlist.tracks); } }}
                  >
                    <div className="track-card__position">
                      {isCurrent && isPlaying ? (
                        <span className="track-card__eq" aria-hidden="true"><span /><span /><span /></span>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
                    <div className="track-card__details">
                      <h3>{track.title}</h3>
                      <p>{track.artist}</p>
                    </div>
                    <span className="track-card__duration">{formatDuration(track.duration)}</span>
                  </div>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </section>

      <CreatePlaylistModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onCreated={handleEdited}
        playlistId={playlist.id}
        initialName={playlist.name}
        initialDescription={playlist.description ?? undefined}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete playlist"
        message={`Delete "${playlist.name}"? This can't be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTotalDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${mins} min`;
}
