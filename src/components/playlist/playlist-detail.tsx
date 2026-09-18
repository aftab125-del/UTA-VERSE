"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContextMenu } from "@/components/ui/context-menu";
import { TrackActions } from "@/components/ui/track-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { showToast } from "@/stores/toast-store";
import type { PlaylistWithTracks, Track } from "@/types/music";

import { MobilePlaylistHeader } from "./mobile/mobile-playlist-header";
import { SortBySheet, type SortOption } from "./mobile/sort-by-sheet";
import { EditDetailsSheet } from "./mobile/edit-details-sheet";
import { AddTracksSheet } from "./mobile/add-tracks-sheet";
import { ReorderTracksSheet } from "./mobile/reorder-tracks-sheet";

interface PlaylistDetailProps {
  playlist: PlaylistWithTracks;
  isOwner: boolean;
}

export function PlaylistDetail({ playlist: initial, isOwner }: PlaylistDetailProps) {
  const [playlist, setPlaylist] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Mobile drawer states
  const [sortOption, setSortOption] = useState<SortOption>("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [addTracksOpen, setAddTracksOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);

  const router = useRouter();
  const setTrack = usePlayerStore((s) => s.setTrack);
  const shufflePlayStore = usePlayerStore((s) => s.shufflePlay);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isShuffled = usePlayerStore((s) => s.isShuffled);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const supabase = createSupabaseBrowserClient();

  const totalDuration = playlist.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  // Derive effective playlist cover (custom cover or fallback to first track artwork)
  const effectiveCover = useMemo(() => {
    return (
      playlist.coverUrl ||
      playlist.tracks.find((t) => Boolean(t.artwork))?.artwork ||
      null
    );
  }, [playlist.coverUrl, playlist.tracks]);

  // Check if playing track belongs to this playlist
  const isCurrentPlaylistPlaying = useMemo(() => {
    return Boolean(currentTrack && playlist.tracks.some((t) => t.id === currentTrack.id));
  }, [currentTrack, playlist.tracks]);

  // Filter & Sort tracks for mobile & desktop views
  const processedTracks = useMemo(() => {
    let list = [...playlist.tracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
      );
    }

    switch (sortOption) {
      case "title":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "artist":
        return list.sort((a, b) => a.artist.localeCompare(b.artist));
      case "album":
        return list.sort((a, b) => (a.album || "").localeCompare(b.album || ""));
      case "recent":
        return [...list].reverse();
      case "custom":
      default:
        return list;
    }
  }, [playlist.tracks, searchQuery, sortOption]);

  function playAll() {
    if (processedTracks.length > 0) {
      void setTrack(processedTracks[0], processedTracks);
    }
  }

  function shufflePlay() {
    if (processedTracks.length === 0) return;
    void shufflePlayStore(processedTracks);
  }

  function handleAddAllToQueue() {
    if (processedTracks.length === 0) return;
    processedTracks.forEach((t) => addToQueue(t));
    showToast(`Added ${processedTracks.length} tracks to queue`);
  }

  async function handleRemoveTrack(trackId: string) {
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlist.id)
      .eq("track_id", trackId);
    if (error) {
      console.error("[PlaylistDetail] Failed to remove track", { playlistId: playlist.id, trackId, error: error.message });
      showToast("Failed to remove track");
      return;
    }
    setPlaylist((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
      trackCount: Math.max(0, prev.trackCount - 1),
    }));
    showToast("Removed from playlist");
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("playlists").delete().eq("id", playlist.id);
    if (error) {
      console.error("[PlaylistDetail] Failed to delete playlist", { playlistId: playlist.id, error: error.message });
      setDeleting(false);
      showToast("Failed to delete playlist");
      return;
    }
    router.push("/playlists");
  }

  function handleEdited(updated: { id: string; name: string }) {
    setPlaylist((prev) => ({ ...prev, name: updated.name }));
    setEditOpen(false);
  }

  function handleDetailsUpdated(updated: {
    name: string;
    description: string | null;
    coverUrl: string | null;
    isPublic: boolean;
  }) {
    setPlaylist((prev) => ({
      ...prev,
      name: updated.name,
      description: updated.description,
      coverUrl: updated.coverUrl,
      isPublic: updated.isPublic,
    }));
  }

  function handleTrackAdded(track: Track) {
    setPlaylist((prev) => ({
      ...prev,
      tracks: [...prev.tracks, track],
      trackCount: prev.trackCount + 1,
    }));
  }

  function handleOrderSaved(newTracks: Track[]) {
    setPlaylist((prev) => ({
      ...prev,
      tracks: newTracks,
    }));
  }

  const existingTrackIds = useMemo(() => new Set(playlist.tracks.map((t) => t.id)), [playlist.tracks]);

  function getTrackActions(track: Track) {
    return [
      { label: "Play next", icon: "→", onClick: () => playNext(track) },
      { label: "Add to queue", icon: "≡", onClick: () => addToQueue(track) },
      ...(isOwner ? [{ label: "Remove from playlist", icon: "×", onClick: () => void handleRemoveTrack(track.id), danger: true }] : []),
    ];
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          MOBILE VIEW (max-width: 768px): Matches Reference Screenshots
          ───────────────────────────────────────────────────────────── */}
      <div className="playlist-detail__mobile">
        <MobilePlaylistHeader
          playlist={playlist}
          isOwner={isOwner}
          isPlaying={isPlaying}
          isCurrentPlaylistPlaying={isCurrentPlaylistPlaying}
          isShuffled={isShuffled}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onPlayAll={playAll}
          onShufflePlay={shufflePlay}
          onOpenSort={() => setSortSheetOpen(true)}
          onOpenEditDetails={() => setEditDetailsOpen(true)}
          onOpenAddTracks={() => setAddTracksOpen(true)}
          onOpenReorder={() => setReorderOpen(true)}
          onAddAllToQueue={handleAddAllToQueue}
        />

        {/* Mobile Tracklist (Matching Screenshot 1) */}
        <div className="mobile-track-list">
          {processedTracks.length === 0 ? (
            <div className="mobile-track-empty">
              {searchQuery ? (
                <p>No songs found for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <div className="empty-panel catalog-state">
                  <span className="empty-panel__mark" aria-hidden="true">≡</span>
                  <h2>This playlist is empty</h2>
                  <p>Tap &ldquo;+ Add&rdquo; above to find songs.</p>
                </div>
              )}
            </div>
          ) : (
            processedTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`mobile-track-row${isCurrent ? " mobile-track-row--current" : ""}`}
                  onClick={() => void setTrack(track, processedTracks)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void setTrack(track, processedTracks);
                    }
                  }}
                >
                  {/* Album art thumbnail on left */}
                  <div className="mobile-track-row__art">
                    {track.artwork ? (
                      <img src={track.artwork} alt="" width={48} height={48} className="mobile-track-row__img" />
                    ) : (
                      <div className="mobile-track-row__art-fallback">♪</div>
                    )}
                  </div>

                  {/* Title and artist in middle */}
                  <div className="mobile-track-row__info">
                    <span className={`mobile-track-row__title${isCurrent ? " mobile-track-row__title--active" : ""}`}>
                      {track.title}
                    </span>
                    <span className="mobile-track-row__artist">{track.artist}</span>
                  </div>

                  {/* 3-dots context menu on right */}
                  <div className="mobile-track-row__actions" onClick={(e) => e.stopPropagation()}>
                    <TrackActions
                      track={track}
                      size="small"
                      variant="dropdown"
                      onRemoveFromPlaylist={isOwner ? () => void handleRemoveTrack(track.id) : undefined}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP VIEW (min-width: 769px): Completely Preserved & Untouched
          ───────────────────────────────────────────────────────────── */}
      <div className="playlist-detail__desktop">
        <div className="detail-hero">
          <div
            className={`playlist-detail__art${isOwner ? " playlist-detail__art--editable" : ""}`}
            onClick={isOwner ? () => setEditDetailsOpen(true) : undefined}
            role={isOwner ? "button" : undefined}
            tabIndex={isOwner ? 0 : undefined}
            onKeyDown={
              isOwner
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditDetailsOpen(true);
                    }
                  }
                : undefined
            }
            title={isOwner ? "Change playlist cover" : undefined}
          >
            <ArtworkTile artwork={effectiveCover || ""} title={playlist.name} size="large" />
            {isOwner && (
              <div className="playlist-detail__art-edit-overlay" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Change photo</span>
              </div>
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
                  <button type="button" className="playlist-detail__edit-btn" onClick={() => setEditDetailsOpen(true)}>Edit</button>
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
                      <div className="track-card__actions" onClick={(e) => e.stopPropagation()}>
                        <TrackActions
                          track={track}
                          size="small"
                          variant="dropdown"
                          onRemoveFromPlaylist={isOwner ? () => void handleRemoveTrack(track.id) : undefined}
                        />
                        <span className="track-card__duration">{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Drawers & Modals ── */}
      <SortBySheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        selectedSort={sortOption}
        onSelectSort={(s) => setSortOption(s)}
      />

      <EditDetailsSheet
        open={editDetailsOpen}
        onClose={() => setEditDetailsOpen(false)}
        playlist={{
          ...playlist,
          coverUrl: effectiveCover,
        }}
        onUpdated={handleDetailsUpdated}
        onDelete={() => {
          setEditDetailsOpen(false);
          setDeleteOpen(true);
        }}
      />

      <AddTracksSheet
        open={addTracksOpen}
        onClose={() => setAddTracksOpen(false)}
        playlistId={playlist.id}
        existingTrackIds={existingTrackIds}
        onTrackAdded={handleTrackAdded}
      />

      <ReorderTracksSheet
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        playlistId={playlist.id}
        tracks={playlist.tracks}
        onOrderSaved={handleOrderSaved}
        onRemoveTrack={(id) => void handleRemoveTrack(id)}
      />

      {/* Desktop Edit Modal */}
      <CreatePlaylistModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onCreated={handleEdited}
        playlistId={playlist.id}
        initialName={playlist.name}
        initialDescription={playlist.description ?? undefined}
      />

      {/* Delete Confirmation */}
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
