import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { TrackCard } from "@/components/music/track-card";
import { CatalogState } from "@/components/catalog/catalog-state";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchCatalog } from "@/lib/music/catalog";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  let results;
  let hasError = false;
  if (query) {
    try {
      const supabase = await createSupabaseServerClient();
      results = await searchCatalog(query, supabase);
    } catch {
      hasError = true;
    }
  }

  return <AppShell><div className="route-content route-content--narrow"><p className="eyebrow">Tune the signal</p><h1 className="route-title">Search</h1><p className="route-lede">Search tracks, artists, and albums in the UTA-VERSE catalog.</p><form className="search-field" action="/search" role="search"><label htmlFor="catalog-search">Search the UTA-VERSE catalog</label><div><input id="catalog-search" name="q" type="search" defaultValue={query} placeholder="Songs, artists, albums…" /><button type="submit">Search</button></div></form>{!query && <CatalogState title="Start with a search" message="Enter a title, artist, or album and submit to search the catalog." />}{hasError && <CatalogState tone="error" title="Search unavailable" message="The catalog search could not be completed. Check the Supabase environment and try again." />}{query && results && !results.tracks.length && !results.albums.length && !results.artists.length && <CatalogState title="No results" message={`Nothing matched “${query}”. Try another title, artist, or album.`} />}{results && results.tracks.length > 0 && <section className="content-section"><SectionHeading title="Tracks" /><div className="track-list">{results.tracks.map((track) => <TrackCard key={track.id} track={track} />)}</div></section>}{results && results.albums.length > 0 && <section className="content-section"><SectionHeading title="Albums" /><div className="card-grid">{results.albums.map((album) => <AlbumCard key={album.id} album={album} />)}</div></section>}{results && results.artists.length > 0 && <section className="content-section"><SectionHeading title="Artists" /><div className="artist-grid">{results.artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div></section>}</div></AppShell>;
}
