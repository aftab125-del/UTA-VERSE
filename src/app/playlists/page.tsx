import { AppShell } from "@/components/shell/app-shell";

export default function PlaylistsPage() {
  return <AppShell><div className="route-content route-content--narrow"><p className="eyebrow">Your compositions</p><h1 className="route-title">Playlists</h1><p className="route-lede">Create and arrange personal listening spaces once the account and playlist data layers are connected.</p><div className="empty-panel"><span className="empty-panel__mark" aria-hidden="true">+</span><h2>Your first playlist is waiting.</h2><p>Playlist creation will connect here in the library phase.</p></div></div></AppShell>;
}
