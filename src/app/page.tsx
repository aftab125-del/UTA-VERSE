import { AppShell } from "@/components/shell/app-shell";
import { BallpitBackground } from "@/components/visual/ballpit-background";
import { SectionHeading } from "@/components/layout/section-heading";
import { TrackCard } from "@/components/music/track-card";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { mockAlbums, mockArtists, mockRecommended, mockRecentlyPlayed, mockTrending } from "@/data/mock-catalog";

export default function HomePage() {
  return (
    <AppShell>
      <section className="home-stage" aria-labelledby="home-heading">
        <BallpitBackground />
        <div className="home-stage__veil" aria-hidden="true" />

        <div className="home-stage__content">
          <p className="eyebrow">The signal is forming</p>
          <h1 id="home-heading">Find your place in the sound.</h1>
          <p className="home-stage__lede">
            UTA-VERSE is a cinematic space for listening, discovery, and the music
            that stays with you.
          </p>
          <div className="home-stage__rule" aria-hidden="true" />
          <p className="home-stage__note">The universe is coming into focus.</p>
        </div>
      </section>

      <div className="home-content">
        <section className="content-section" aria-labelledby="featured-heading">
          <SectionHeading eyebrow="A first transmission" title="Featured" />
          <div className="featured-panel">
            <div>
              <p className="featured-panel__eyebrow">Curated for the late hours</p>
              <h2 id="featured-heading">Sound with room to breathe.</h2>
              <p>Explore a small collection of atmospheric tracks while the UTA-VERSE catalog takes shape.</p>
              <a className="text-button" href="/discover">Enter Discover <span aria-hidden="true">→</span></a>
            </div>
            <div className="featured-panel__orb" aria-hidden="true" />
          </div>
        </section>

        <section className="content-section" aria-labelledby="recent-heading">
          <SectionHeading eyebrow="Your orbit" title="Recently Played" href="/library" />
          <div className="track-list" id="recent-heading">
            {mockRecentlyPlayed.map((track) => <TrackCard key={track.id} track={track} />)}
          </div>
        </section>

        <section className="content-section" aria-labelledby="trending-heading">
          <SectionHeading eyebrow="Moving through the signal" title="Trending" href="/discover" />
          <div className="track-list" id="trending-heading">
            {mockTrending.map((track) => <TrackCard key={track.id} track={track} />)}
          </div>
        </section>

        <section className="content-section" aria-labelledby="recommended-heading">
          <SectionHeading eyebrow="Selected for you" title="Recommended" />
          <div className="track-grid" id="recommended-heading">
            {mockRecommended.map((track) => <TrackCard key={track.id} track={track} variant="tile" />)}
          </div>
        </section>

        <section className="content-section" aria-labelledby="albums-heading">
          <SectionHeading title="Albums in the atmosphere" />
          <div className="card-grid" id="albums-heading">
            {mockAlbums.map((album) => <AlbumCard key={album.id} album={album} />)}
          </div>
        </section>

        <section className="content-section" aria-labelledby="artists-heading">
          <SectionHeading title="Artists to watch" />
          <div className="artist-grid" id="artists-heading">
            {mockArtists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
