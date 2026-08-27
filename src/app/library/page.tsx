import { CatalogState } from "@/components/catalog/catalog-state";
import { AppShell } from "@/components/shell/app-shell";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";
import { BlurText } from "@/components/reactbits/BlurText";

export default function LibraryPage() {
  return <AppShell><DarkVeilBackground /><div className="route-content route-content--narrow"><p className="eyebrow">Your collection</p><h1 className="route-title"><BlurText text="Library" animateBy="words" direction="top" delay={300} stepDuration={0.8} /></h1><p className="route-lede">A home for the tracks and collections you choose to keep close.</p><CatalogState title="Sign in to build your library" message="Liked songs and listening history require the authentication and account-data phase." /></div></AppShell>;
}
