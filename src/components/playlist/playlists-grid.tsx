"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { CreatePlaylistModal } from "@/components/ui/create-playlist-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Playlist } from "@/types/music";

interface PlaylistsGridProps {
  userId: string;
}

export function PlaylistsGrid({ userId }: PlaylistsGridProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function loadPlaylists() {
    const { data } = await supabase
      .from("playlists")
      .select("*, playlist_tracks(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) {
      setPlaylists(data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        coverUrl: row.cover_url,
        folderId: row.folder_id,
        isPublic: row.is_public,
        trackCount: row.playlist_tracks[0]?.count ?? 0,
        totalDuration: 0,
        createdAt: row.created_at,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { void loadPlaylists(); }, [userId]);

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
    await supabase.from("playlists").delete().eq("id", deleteTarget.id);
    setPlaylists((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  if (loading) return <div className="library-loading">Loading playlists…</div>;

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
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" width={160} height={160} />
                  ) : (
                    <ArtworkTile artwork="" title={pl.name} size="large" />
                  )}
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
