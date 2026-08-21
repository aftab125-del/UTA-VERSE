import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { AlbumCard } from "@/components/music/album-card";
import { TrackCard } from "@/components/music/track-card";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArtistPageData } from "@/lib/music/catalog";
import type { ArtistPageData } from "@/lib/music/catalog";

export const dynamic = "force-dynamic";

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadArtistData(id);
  if (result.error) return <AppShell><div className="route-content route-content--narrow"><Link className="back-link" href="/discover">← Back to Discover</Link><CatalogState tone="error" title="Artist unavailable" message="The artist could not be loaded from the catalog." /></div></AppShell>;
  if (!result.data) return <AppShell><div className="route-content route-content--narrow"><Link className="back-link" href="/discover">← Back to Discover</Link><CatalogState title="Artist not found" message="This artist is not present in the Supabase catalog." /></div></AppShell>;
  const { data } = result;
  return <AppShell><div className="route-content"><Link className="back-link" href="/discover">← Back to Discover</Link><div className="detail-hero detail-hero--artist"><ArtworkTile artwork={data.artist.artwork} title={data.artist.name} circular size="large" /><div><p className="eyebrow">Artist signal</p><h1 className="route-title">{data.artist.name}</h1><p className="route-lede">{data.artist.bio || data.artist.genre || "Artist in the UTA-VERSE catalog"}</p></div></div><section className="content-section"><h2>Tracks</h2>{data.tracks.length ? <div className="track-list">{data.tracks.map((track) => <TrackCard key={track.id} track={track} />)}</div> : <CatalogState title="No tracks yet" message="This artist has no tracks in the catalog yet." />}</section><section className="content-section"><h2>Albums</h2>{data.albums.length ? <div className="card-grid">{data.albums.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <CatalogState title="No albums yet" message="This artist has no albums in the catalog yet." />}</section></div></AppShell>;
}

async function loadArtistData(id: string): Promise<{ data?: ArtistPageData | null; error?: boolean }> {
  try { return { data: await getArtistPageData(id, await createSupabaseServerClient()) }; } catch { return { error: true }; }
}
