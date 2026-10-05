"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getUserPlaylists } from "@/lib/music/playlists";
import type { Playlist } from "@/types/music";

interface PlaylistsGridProps {
  userId: string;
  initialPlaylists?: Playlist[];
}

export function PlaylistsGrid({ userId, initialPlaylists = [] }: PlaylistsGridProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [loading, setLoading] = useState(initialPlaylists.length === 0);
  const [createOpen, setCreateOpen] = useState(false);
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("playlists").delete().eq("id", deleteTarget.id);
    if (error) {
      console.error("[PlaylistsGrid] Failed to delete playlist", { playlistId: deleteTarget.id, error: error.message });
      setDeleting(false);
      return;
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
        <button type="button" className="liked-songs__play-btn" onClick={() => setCreateOpen(true)}>
          + Create Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-panel catalog-state">
          <span className="empty-panel__mark" aria-hidden="true">≡</span>
          <h2>No playlists yet</h2>
          <p>Create your first playlist to start organizing your music.</p>
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
