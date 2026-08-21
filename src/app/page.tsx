import Link from "next/link";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { TrackCard } from "@/components/music/track-card";
import { CatalogState } from "@/components/catalog/catalog-state";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { BallpitBackground } from "@/components/visual/ballpit-background";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAlbums, getArtists, getTracks } from "@/lib/music/catalog";
import type { Album, Artist, Track } from "@/types/music";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadHomeData();
  if (!result.data) return <AppShell><HomeStage /><div className="home-content"><CatalogState tone="error" title="Catalog unavailable" message="The music catalog could not be loaded. Check the Supabase environment and try again." /></div></AppShell>;
  const { tracks, albums, artists } = result.data;
    const featured = tracks.slice(0, 4);
    const trending = tracks.slice(4, 9);
    const recommended = tracks.slice(9, 13);

    return (
      <AppShell>
        <HomeStage />
        <div className="home-content">
          <section className="content-section" aria-labelledby="featured-heading">
            <SectionHeading eyebrow="A first transmission" title="Featured" />
            <div className="featured-panel">
              <div>
                <p className="featured-panel__eyebrow">From the live catalog</p>
                <h2 id="featured-heading">Sound with room to breathe.</h2>
                <p>Explore the latest tracks currently available in the UTA-VERSE catalog.</p>
                <Link className="text-button" href="/discover">Enter Discover <span aria-hidden="true">→</span></Link>
              </div>
              <div className="featured-panel__orb" aria-hidden="true" />
            </div>
            {featured.length ? <div className="track-list" style={{ marginTop: "1.25rem" }}>{featured.map((track) => <TrackCard key={track.id} track={track} />)}</div> : <CatalogState title="Catalog is waiting" message="Featured tracks will appear once catalog records are available." />}
          </section>

          <CatalogTrackSection title="Recently Played" eyebrow="Your orbit" href="/library" tracks={[]} emptyMessage="Listening history will appear after the history feature is connected." />
          <CatalogTrackSection title="Trending" eyebrow="Moving through the signal" href="/discover" tracks={trending} emptyMessage="Trending tracks will appear once catalog data is available." />
          <CatalogTrackSection title="Recommended" eyebrow="Catalog-based selection" tracks={recommended} emptyMessage="Personal recommendations require listening data and are not enabled yet." variant="tile" />

          <section className="content-section" aria-labelledby="albums-heading">
            <SectionHeading title="Albums in the atmosphere" />
            {albums.length ? <div className="card-grid" id="albums-heading">{albums.map((album) => <AlbumCard key={album.id} album={album} />)}</div> : <CatalogState title="No albums yet" message="Albums will appear when the Supabase catalog is seeded." />}
          </section>
          <section className="content-section" aria-labelledby="artists-heading">
            <SectionHeading title="Artists to watch" />
            {artists.length ? <div className="artist-grid" id="artists-heading">{artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</div> : <CatalogState title="No artists yet" message="Artists will appear when the Supabase catalog is seeded." />}
          </section>
        </div>
      </AppShell>
    );
}

async function loadHomeData(): Promise<{ data?: { tracks: Track[]; albums: Album[]; artists: Artist[] } }> {
  try {
    const supabase = await createSupabaseServerClient();
    const [tracks, albums, artists] = await Promise.all([getTracks(supabase, 24), getAlbums(supabase, 8), getArtists(supabase, 8)]);
    return { data: { tracks, albums, artists } };
  } catch {
    return {};
  }
}

function HomeStage() {
  return <section className="home-stage" aria-labelledby="home-heading"><BallpitBackground /><div className="home-stage__veil" aria-hidden="true" /><div className="home-stage__content"><p className="eyebrow">The signal is forming</p><h1 id="home-heading">Find your place in the sound.</h1><p className="home-stage__lede">UTA-VERSE is a cinematic space for listening, discovery, and the music that stays with you.</p><div className="home-stage__rule" aria-hidden="true" /><p className="home-stage__note">The universe is coming into focus.</p></div></section>;
}

function CatalogTrackSection({ title, eyebrow, href, tracks, emptyMessage, variant = "row" }: { title: string; eyebrow: string; href?: string; tracks: Awaited<ReturnType<typeof getTracks>>; emptyMessage: string; variant?: "row" | "tile" }) {
  return <section className="content-section"><SectionHeading eyebrow={eyebrow} title={title} href={href} /><div className={variant === "tile" ? "track-grid" : "track-list"}>{tracks.length ? tracks.map((track) => <TrackCard key={track.id} track={track} variant={variant} />) : <CatalogState title="Nothing here yet" message={emptyMessage} />}</div></section>;
}
