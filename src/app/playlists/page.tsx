import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlaylistsPageContent } from "@/components/playlist/playlists-page-content";
import { getUserPlaylists } from "@/lib/music/playlists";
import type { Playlist } from "@/types/music";

export default async function PlaylistsPage() {
  let user = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable; local-user fallback
  }

  let initialPlaylists: Playlist[] = [];
  if (user) {
    try {
      const supabase = await createSupabaseServerClient();
      initialPlaylists = await getUserPlaylists(user.id, supabase);
    } catch {
      // ignore
    }
  }

  const effectiveUserId = user?.id ?? "local-user";

  return (
    <AppShell>
      <div className="route-content route-content--narrow route-content--centered">
        <p className="eyebrow">Your compositions</p>
        <h1 className="route-title">Playlists</h1>
        <p className="route-lede">Create and arrange personal listening spaces.</p>

        <PlaylistsPageContent userId={effectiveUserId} initialPlaylists={initialPlaylists} />
      </div>
    </AppShell>
  );
}
