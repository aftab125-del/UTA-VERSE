import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlaylistsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell>
      <div className="route-content route-content--narrow">
        <p className="eyebrow">Your compositions</p>
        <h1 className="route-title">Playlists</h1>
        <p className="route-lede">Create and arrange personal listening spaces once account access is available.</p>

        {user ? (
          <CatalogState
            title="No playlists yet"
            message="Create your first playlist to start organizing your listening experience. Playlist creation is coming soon."
          />
        ) : (
          <>
            <CatalogState
              title="Sign in to manage playlists"
              message="Playlist ownership is protected by Supabase RLS and will be connected in the authentication phase."
            />
            <Link href="/auth/signin" className="auth-cta-link">
              Sign in to get started
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
