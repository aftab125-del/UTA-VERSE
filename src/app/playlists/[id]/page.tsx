import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaylistWithTracks } from "@/lib/music/playlists";
import { PlaylistDetail } from "@/components/playlist/playlist-detail";
import { PlaylistClientHydrator } from "@/components/playlist/playlist-client-hydrator";

export const dynamic = "force-dynamic";

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable
  }

  let playlist = null;
  try {
    const supabase = await createSupabaseServerClient();
    playlist = await getPlaylistWithTracks(id, supabase);
  } catch {
    // Cloud lookup failed or restricted
  }

  // If server didn't find playlist (e.g. stored locally in client IndexedDB), hydrate on client
  if (!playlist) {
    return (
      <AppShell>
        <PlaylistClientHydrator playlistId={id} />
      </AppShell>
    );
  }

  const isOwner = user?.id === playlist.userId;

  return (
    <AppShell>
      <div className="route-content">
        <Link className="back-link" href="/playlists">
          ← Back to Playlists
        </Link>
        <PlaylistDetail playlist={playlist} isOwner={isOwner} />
      </div>
    </AppShell>
  );
}
