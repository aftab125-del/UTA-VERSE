import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { TrackCard } from "@/components/music/track-card";
import { CatalogState } from "@/components/catalog/catalog-state";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAlbums, getArtists, getTracks } from "@/lib/music/catalog";
import type { Album, Artist, Track } from "@/types/music";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const result = await loadDiscoverData();
  if (!result.data) return <AppShell><div className="route-content"><CatalogState tone="error" title="Discover is unavailable" message="The catalog could not be loaded. Check the Supabase environment and try again." /></div></AppShell>;
  const { tracks, albums, artists } = result.data;
  return <AppShell><div className="route-content"><p className="eyebrow">Open frequencies</p><h1 className="route-title">Discover</h1><p className="route-lede">New signals, deep cuts, and the next places your listening can go.</p><section className="content-section"><SectionHeading title="Tracks" />{tracks.length ? <div className="track-list">{tracks.map((track) => <TrackCard key={track.id} track={track} />)}</div> : <CatalogState title="No tracks yet" message="Tracks will appear when the Supabase catalog is seeded." />}</section><section className="content-section"><SectionHeading title="Albums in the atmosphere" />{albums.length ? <div className="card-grid">{albums.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <CatalogState title="No albums yet" message="Albums will appear when the Supabase catalog is seeded." />}</section><section className="content-section"><SectionHeading title="Artists to watch" />{artists.length ? <div className="artist-grid">{artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div> : <CatalogState title="No artists yet" message="Artists will appear when the Supabase catalog is seeded." />}</section></div></AppShell>;
}

async function loadDiscoverData(): Promise<{ data?: { tracks: Track[]; albums: Album[]; artists: Artist[] } }> {
  try {
    const supabase = await createSupabaseServerClient();
    const [tracks, albums, artists] = await Promise.all([getTracks(supabase, 24), getAlbums(supabase, 12), getArtists(supabase, 12)]);
    return { data: { tracks, albums, artists } };
  } catch {
    return {};
  }
}
