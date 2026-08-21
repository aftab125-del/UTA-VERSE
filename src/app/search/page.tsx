import { AppShell } from "@/components/shell/app-shell";

export default function SearchPage() {
  return <AppShell><div className="route-content route-content--narrow"><p className="eyebrow">Tune the signal</p><h1 className="route-title">Search</h1><p className="route-lede">The catalog search boundary is ready for its approved provider.</p><form className="search-field" action="/search" role="search"><label htmlFor="catalog-search">Search the UTA-VERSE catalog</label><div><input id="catalog-search" name="q" type="search" placeholder="Songs, artists, albums…" /><button type="submit">Search</button></div></form></div></AppShell>;
}
