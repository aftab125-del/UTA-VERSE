import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaylistWithTracks } from "@/lib/music/playlists";
import { PlaylistDetail } from "@/components/playlist/playlist-detail";

export const dynamic = "force-dynamic";

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let playlist;
  try {
    playlist = await getPlaylistWithTracks(id, supabase);
  } catch {
    return (
      <AppShell>
        <div className="route-content route-content--narrow">
          <Link className="back-link" href="/playlists">← Back to Playlists</Link>
          <CatalogState tone="error" title="Playlist unavailable" message="Could not load this playlist." />
        </div>
      </AppShell>
    );
  }

  if (!playlist) {
    return (
      <AppShell>
        <div className="route-content route-content--narrow">
          <Link className="back-link" href="/playlists">← Back to Playlists</Link>
          <CatalogState title="Playlist not found" message="This playlist doesn't exist or has been deleted." />
        </div>
      </AppShell>
    );
  }

  const isOwner = user?.id === playlist.userId;

  return (
    <AppShell>
      <div className="route-content">
        <Link className="back-link" href="/playlists">← Back to Playlists</Link>
        <PlaylistDetail playlist={playlist} isOwner={isOwner} />
      </div>
    </AppShell>
  );
}
