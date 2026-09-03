import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlaylistsGrid } from "@/components/playlist/playlists-grid";

export default async function PlaylistsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell>
      <div className="route-content route-content--narrow">
        <p className="eyebrow">Your compositions</p>
        <h1 className="route-title">Playlists</h1>
        <p className="route-lede">Create and arrange personal listening spaces.</p>

        {user ? (
          <PlaylistsGrid userId={user.id} />
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
