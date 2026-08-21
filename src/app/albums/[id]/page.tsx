import Link from "next/link";
import { CatalogState } from "@/components/catalog/catalog-state";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { TrackCard } from "@/components/music/track-card";
import { AppShell } from "@/components/shell/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAlbumPageData } from "@/lib/music/catalog";
import type { AlbumPageData } from "@/lib/music/catalog";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadAlbumData(id);
  if (result.error) return <AppShell><div className="route-content route-content--narrow"><Link className="back-link" href="/discover">← Back to Discover</Link><CatalogState tone="error" title="Album unavailable" message="The album could not be loaded from the catalog." /></div></AppShell>;
  if (!result.data) return <AppShell><div className="route-content route-content--narrow"><Link className="back-link" href="/discover">← Back to Discover</Link><CatalogState title="Album not found" message="This album is not present in the Supabase catalog." /></div></AppShell>;
  const { data } = result;
  return <AppShell><div className="route-content"><Link className="back-link" href="/discover">← Back to Discover</Link><div className="detail-hero"><ArtworkTile artwork={data.album.artwork} title={data.album.title} size="large" /><div><p className="eyebrow">Album signal</p><h1 className="route-title">{data.album.title}</h1><p className="route-lede">{data.album.artist} · {data.album.trackCount} tracks</p></div></div><section className="content-section"><h2 className="visually-hidden">Tracks</h2>{data.tracks.length ? <div className="track-list">{data.tracks.map((track) => <TrackCard key={track.id} track={track} />)}</div> : <CatalogState title="No tracks in this album" message="This album exists, but no tracks are currently attached." />}</section></div></AppShell>;
}

async function loadAlbumData(id: string): Promise<{ data?: AlbumPageData | null; error?: boolean }> {
  try { return { data: await getAlbumPageData(id, await createSupabaseServerClient()) }; } catch { return { error: true }; }
}
