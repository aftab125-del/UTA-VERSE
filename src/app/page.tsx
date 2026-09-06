import Link from "next/link";
import { AlbumCard } from "@/components/music/album-card";
import { ArtistCard } from "@/components/music/artist-card";
import { TrackCard } from "@/components/music/track-card";
import { CatalogState } from "@/components/catalog/catalog-state";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { BlurText } from "@/components/reactbits/BlurText";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAlbums, getArtists, getTracks } from "@/lib/music/catalog";
import { getRecentlyPlayedWithDetails } from "@/lib/music/library";
import { getUserListeningStats } from "@/lib/music/stats";
import type { Album, Artist, Track } from "@/types/music";
import type { UserListeningStats } from "@/lib/music/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadHomeData();
  if (!result.data) {
    return (
      <AppShell>
        <HomeStage />
        <div className="home-content">
          <CatalogState
            tone="error"
            title="Catalog unavailable"
            message="The music catalog could not be loaded. Check the Supabase environment and try again."
          />
        </div>
      </AppShell>
    );
  }

  const { tracks, albums, artists, user, displayName, stats, recentlyPlayed } = result.data;
  const featured = tracks.slice(0, 4);
  const trending = tracks.slice(4, 9);
  const recommended = tracks.slice(9, 13);

  return (
    <AppShell>
      <HomeStage displayName={displayName} isUser={Boolean(user)} />
      <div className="home-content">
        {/* 1. Personal Listening Telemetry Dashboard (React Bits Pro Stats-14 with 3D Tilt) */}
        <PersonalDashboard stats={stats} isGuest={!user} />

        {/* 2. Jump Back In / Recently Played (if user has active history) */}
        {recentlyPlayed.length > 0 && (
          <CatalogTrackSection
            title="Recently Played"
            eyebrow="Your orbit"
            href="/playlists"
            tracks={recentlyPlayed}
            emptyMessage="Listening history will appear as you play tracks."
          />
        )}

        {/* 3. Featured Transmission */}
        <section className="content-section" aria-labelledby="featured-heading">
          <SectionHeading eyebrow="Live Transmission" title="Featured Sound" />
          <div className="featured-panel">
            <div>
              <p className="featured-panel__eyebrow">From the live catalog</p>
              <h2 id="featured-heading">Sound with room to breathe.</h2>
              <p>Explore the latest tracks currently available in the UTA-VERSE catalog.</p>
              <Link className="text-button" href="/discover">
                Enter Discover <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="featured-panel__orb" aria-hidden="true" />
          </div>
          {featured.length ? (
            <div className="track-list" style={{ marginTop: "1.25rem" }}>
              {featured.map((track) => (
                <TrackCard key={track.id} track={track} />
              ))}
            </div>
          ) : (
            <CatalogState
              title="Catalog is waiting"
              message="Featured tracks will appear once catalog records are available."
            />
          )}
        </section>

        {/* 4. Trending */}
        <CatalogTrackSection
          title="Trending"
          eyebrow="Moving through the signal"
          href="/discover"
          tracks={trending}
          emptyMessage="Trending tracks will appear once catalog data is available."
        />

        {/* 5. Recommended */}
        <CatalogTrackSection
          title="Recommended"
          eyebrow="Catalog-based selection"
          tracks={recommended}
          emptyMessage="Personal recommendations require listening data and are not enabled yet."
          variant="tile"
        />

        {/* 6. Albums in the atmosphere */}
        <section className="content-section" aria-labelledby="albums-heading">
          <SectionHeading title="Albums in the atmosphere" />
          {albums.length ? (
            <div className="card-grid" id="albums-heading">
              {albums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          ) : (
            <CatalogState
              title="No albums yet"
              message="Albums will appear when the Supabase catalog is seeded."
            />
          )}
        </section>

        {/* 7. Artists to watch */}
        <section className="content-section" aria-labelledby="artists-heading">
          <SectionHeading title="Artists to watch" />
          {artists.length ? (
            <div className="artist-grid" id="artists-heading">
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          ) : (
            <CatalogState
              title="No artists yet"
              message="Artists will appear when the Supabase catalog is seeded."
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}

interface HomeDataResult {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  user: { id: string; email?: string } | null;
  displayName: string | null;
  stats: UserListeningStats;
  recentlyPlayed: Track[];
}

async function loadHomeData(): Promise<{ data?: HomeDataResult }> {
  try {
    const supabase = await createSupabaseServerClient();

    // Fetch user & catalog in parallel
    const [authRes, tracks, albums, artists] = await Promise.all([
      supabase.auth.getUser().catch(() => ({ data: { user: null } })),
      getTracks(supabase, 24),
      getAlbums(supabase, 8),
      getArtists(supabase, 8),
    ]);

    const user = authRes?.data?.user ?? null;
    let displayName: string | null = null;
    let stats: UserListeningStats;
    let recentlyPlayed: Track[] = [];

    if (user) {
      displayName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "Cosmonaut";

      [stats, recentlyPlayed] = await Promise.all([
        getUserListeningStats(user.id, supabase),
        getRecentlyPlayedWithDetails(user.id, supabase, 6).catch(() => []),
      ]);
    } else {
      stats = await getUserListeningStats("", supabase);
    }

    return {
      data: {
        tracks,
        albums,
        artists,
        user,
        displayName,
        stats,
        recentlyPlayed,
      },
    };
  } catch {
    return {};
  }
}

interface HomeStageProps {
  displayName?: string | null;
  isUser?: boolean;
}

function HomeStage({ displayName, isUser }: HomeStageProps) {
  const headline = isUser ? "Your space in the sound." : "Find your place in the sound.";
  const greeting = isUser && displayName
    ? `Welcome back, ${displayName}. Personal listening telemetry, heavy rotation, and your universe of music.`
    : "UTA-VERSE is a cinematic space for listening, discovery, and the music that stays with you.";

  return (
    <section className="home-stage" aria-labelledby="home-heading">
      <div className="home-stage__veil" aria-hidden="true" />
      <div className="home-stage__content">
        <p className="eyebrow">{isUser ? "Your Orbit" : "The signal is forming"}</p>
        <h1 id="home-heading">
          <BlurText
            text={headline}
            animateBy="words"
            direction="top"
            delay={300}
            stepDuration={0.8}
          />
        </h1>
        <p className="home-stage__lede">{greeting}</p>
        <p className="home-stage__credit">Made by Aftab Kathat</p>
        <div className="home-stage__rule" aria-hidden="true" />
        <p className="home-stage__note">
          {isUser ? "Telemetry active • 30-day rolling window" : "The universe is coming into focus."}
        </p>
      </div>
    </section>
  );
}

function CatalogTrackSection({
  title,
  eyebrow,
  href,
  tracks,
  emptyMessage,
  variant = "row",
}: {
  title: string;
  eyebrow: string;
  href?: string;
  tracks: Awaited<ReturnType<typeof getTracks>>;
  emptyMessage: string;
  variant?: "row" | "tile";
}) {
  return (
    <section className="content-section">
      <SectionHeading eyebrow={eyebrow} title={title} href={href} />
      <div className={variant === "tile" ? "track-grid" : "track-list"}>
        {tracks.length ? (
          tracks.map((track) => <TrackCard key={track.id} track={track} variant={variant} />)
        ) : (
          <CatalogState title="Nothing here yet" message={emptyMessage} />
        )}
      </div>
    </section>
  );
}
