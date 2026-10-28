"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";
import { SpotifyImportModal } from "@/components/playlist/spotify-import-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getUserPlaylists, deletePlaylist } from "@/lib/music/playlists";
import type { Playlist } from "@/types/music";

interface PlaylistsGridProps {
  userId: string;
  initialPlaylists?: Playlist[];
}

export function PlaylistsGrid({ userId, initialPlaylists = [] }: PlaylistsGridProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [loading, setLoading] = useState(initialPlaylists.length === 0);
  const [createOpen, setCreateOpen] = useState(false);
  const [spotifyImportOpen, setSpotifyImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [supabase] = useState(() => createSupabaseBrowserClient());

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await getUserPlaylists(userId, supabase);
        if (!ignore) {
          setPlaylists(data);
        }
      } catch (err) {
        console.error("[PlaylistsGrid] Failed to load playlists:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [userId, supabase]);

  function handleCreated(playlist: { id: string; name: string }) {
    setPlaylists((prev) => [{
      id: playlist.id,
      userId,
      name: playlist.name,
      description: null,
      coverUrl: null,
      folderId: null,
      isPublic: false,
      trackCount: 0,
      totalDuration: 0,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setCreateOpen(false);
  }

  async function handleImported(imported: { id: string; name: string }) {
    try {
      const data = await getUserPlaylists(userId, supabase);
      setPlaylists(data);
    } catch {
      setPlaylists((prev) => [{
        id: imported.id,
        userId,
        name: imported.name,
        description: "Imported from Spotify",
        coverUrl: null,
        folderId: null,
        isPublic: false,
        trackCount: 0,
        totalDuration: 0,
        createdAt: new Date().toISOString(),
      }, ...prev]);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePlaylist(deleteTarget.id, supabase);
    } catch (err) {
      console.warn("[PlaylistsGrid] Delete error:", err);
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  if (loading) {
    return (
      <>
        <div className="playlists-header">
          <button type="button" className="liked-songs__play-btn" disabled>
            + Create Playlist
          </button>
        </div>
        <div className="playlists-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="playlist-card playlist-card--skeleton">
              <div className="playlist-card__art playlist-card__art--skeleton shimmer" />
              <div className="playlist-card__info">
                <div className="playlist-skeleton-title shimmer" />
                <div className="playlist-skeleton-sub shimmer" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="playlists-header">
        <button
          type="button"
          className="btn-spotify-import"
          onClick={() => setSpotifyImportOpen(true)}
        >
          <svg className="btn-spotify-import__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.31c-.217.355-.678.47-1.033.253-2.83-1.73-6.393-2.122-10.59-1.164-.407.094-.814-.16-.907-.568-.094-.408.16-.814.568-.907 4.607-1.053 8.563-.604 11.71 1.352.354.217.47.678.252 1.034zm1.468-3.264c-.273.444-.858.587-1.302.314-3.24-1.992-8.18-2.57-12.013-1.405-.498.152-1.03-.133-1.182-.632-.152-.5.133-1.03.632-1.182 4.382-1.33 9.82-.689 13.551 1.603.444.273.587.858.314 1.302zm.126-3.41c-3.885-2.308-10.3-2.522-14.02-1.393-.595.18-1.227-.156-1.408-.75-.18-.596.155-1.228.75-1.408 4.28-1.3 11.375-1.047 15.86 1.614.536.318.71 1.015.392 1.55-.318.536-1.015.71-1.574.387z" />
          </svg>
          Import from Spotify
        </button>
        <button type="button" className="liked-songs__play-btn" onClick={() => setCreateOpen(true)}>
          + Create Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-panel catalog-state">
          <span className="empty-panel__mark" aria-hidden="true">≡</span>
          <h2>No playlists yet</h2>
          <p>Create your first playlist or import an existing one from Spotify.</p>
          <div className="empty-panel__actions" style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem" }}>
            <button
              type="button"
              className="btn-spotify-import"
              onClick={() => setSpotifyImportOpen(true)}
            >
              <svg className="btn-spotify-import__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.31c-.217.355-.678.47-1.033.253-2.83-1.73-6.393-2.122-10.59-1.164-.407.094-.814-.16-.907-.568-.094-.408.16-.814.568-.907 4.607-1.053 8.563-.604 11.71 1.352.354.217.47.678.252 1.034zm1.468-3.264c-.273.444-.858.587-1.302.314-3.24-1.992-8.18-2.57-12.013-1.405-.498.152-1.03-.133-1.182-.632-.152-.5.133-1.03.632-1.182 4.382-1.33 9.82-.689 13.551 1.603.444.273.587.858.314 1.302zm.126-3.41c-3.885-2.308-10.3-2.522-14.02-1.393-.595.18-1.227-.156-1.408-.75-.18-.596.155-1.228.75-1.408 4.28-1.3 11.375-1.047 15.86 1.614.536.318.71 1.015.392 1.55-.318.536-1.015.71-1.574.387z" />
              </svg>
              Import from Spotify
            </button>
            <button type="button" className="liked-songs__play-btn" onClick={() => setCreateOpen(true)}>
              + Create Playlist
            </button>
          </div>
        </div>
      ) : (
        <div className="playlists-grid">
          {playlists.map((pl) => (
            <div key={pl.id} className="playlist-card">
              <Link href={`/playlists/${pl.id}`} className="playlist-card__link">
                <div className="playlist-card__art">
                  <ArtworkTile artwork={pl.coverUrl || ""} title={pl.name} size="large" />
                </div>
                <div className="playlist-card__info">
                  <strong>{pl.name}</strong>
                  <span>{pl.trackCount} track{pl.trackCount !== 1 ? "s" : ""}</span>
                </div>
              </Link>
              <button
                type="button"
                className="playlist-card__delete"
                onClick={() => setDeleteTarget(pl)}
                aria-label={`Delete ${pl.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <CreatePlaylistModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <SpotifyImportModal
        open={spotifyImportOpen}
        onClose={() => setSpotifyImportOpen(false)}
        onImported={handleImported}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete playlist"
        message={`Delete "${deleteTarget?.name}"? This can't be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
