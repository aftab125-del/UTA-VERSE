import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";

export default function PlaylistsPage() {
  return <AppShell><div className="route-content route-content--narrow"><p className="eyebrow">Your compositions</p><h1 className="route-title">Playlists</h1><p className="route-lede">Create and arrange personal listening spaces once account access is available.</p><CatalogState title="Sign in to manage playlists" message="Playlist ownership is protected by Supabase RLS and will be connected in the authentication phase." /></div></AppShell>;
}
