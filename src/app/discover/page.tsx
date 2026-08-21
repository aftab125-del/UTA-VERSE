import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { mockAlbums, mockArtists } from "@/data/mock-catalog";

export default function DiscoverPage() {
  return <AppShell><div className="route-content"><p className="eyebrow">Open frequencies</p><h1 className="route-title">Discover</h1><p className="route-lede">New signals, deep cuts, and the next places your listening can go.</p><section className="content-section"><SectionHeading title="Albums in the atmosphere" /><div className="card-grid">{mockAlbums.map((album) => <AlbumCard key={album.id} album={album} />)}</div></section><section className="content-section"><SectionHeading title="Artists to watch" /><div className="artist-grid">{mockArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div></section></div></AppShell>;
}
