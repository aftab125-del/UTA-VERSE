"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { PlaylistDetail } from "@/components/playlist/playlist-detail";
import { getPlaylistWithTracks } from "@/lib/music/playlists";
import type { PlaylistWithTracks } from "@/types/music";

export function PlaylistClientHydrator({ playlistId }: { playlistId: string }) {
  const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getPlaylistWithTracks(playlistId);
        if (!ignore) {
          setPlaylist(res);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [playlistId]);

  if (loading) {
    return (
      <div className="library-loading" style={{ minHeight: "300px" }}>
        Loading playlist…
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="route-content route-content--narrow">
        <Link className="back-link" href="/playlists">
          ← Back to Playlists
        </Link>
        <CatalogState
          title="Playlist not found"
          message="This playlist doesn't exist or has been deleted."
        />
      </div>
    );
  }

  return (
    <div className="route-content">
      <Link className="back-link" href="/playlists">
        ← Back to Playlists
      </Link>
      <PlaylistDetail playlist={playlist} isOwner={true} />
    </div>
  );
}
