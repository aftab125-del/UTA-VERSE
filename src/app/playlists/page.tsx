import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlaylistsPageContent } from "@/components/playlist/playlists-page-content";
import { getUserPlaylists } from "@/lib/music/playlists";
import type { Playlist } from "@/types/music";

export default async function PlaylistsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialPlaylists: Playlist[] = [];
  if (user) {
    try {
      initialPlaylists = await getUserPlaylists(user.id, supabase);
    } catch (err) {
      console.error("[PlaylistsPage] Failed to fetch server-side playlists:", err);
    }
  }

  return (
    <AppShell>
      <div className="route-content route-content--narrow route-content--centered">
        <p className="eyebrow">Your compositions</p>
        <h1 className="route-title">Playlists</h1>
        <p className="route-lede">Create and arrange personal listening spaces.</p>

        {user ? (
          <PlaylistsPageContent userId={user.id} initialPlaylists={initialPlaylists} />
        ) : (
          <>
            <div className="empty-panel catalog-state">
              <span className="empty-panel__mark" aria-hidden="true">≡</span>
              <h2>Sign in to manage playlists</h2>
              <p>Playlist ownership is protected by Supabase RLS.</p>
            </div>
            <Link href="/auth/signin" className="auth-cta-link">
              Sign in to get started
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
