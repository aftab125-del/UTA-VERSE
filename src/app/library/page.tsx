import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";

export default function LibraryPage() {
  return <AppShell><div className="route-content route-content--narrow"><p className="eyebrow">Your collection</p><h1 className="route-title">Library</h1><p className="route-lede">A home for the tracks and collections you choose to keep close.</p><CatalogState title="Sign in to build your library" message="Liked songs and listening history require the authentication and account-data phase." /></div></AppShell>;
}
