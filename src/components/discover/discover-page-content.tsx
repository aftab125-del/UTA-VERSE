"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getTopArtists, getRecentlyPlayedWithDetails } from "@/lib/music/library";
import { TopArtistsStack } from "@/components/discover/top-artists-stack";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { LikeButton, AddToPlaylistButton, AddToQueueButton } from "@/components/ui/track-actions";
import { SectionHeading } from "@/components/layout/section-heading";
import { BlurText } from "@/components/reactbits/BlurText";
import { usePlayerStore } from "@/stores/player-store";
import type { TopArtist, Track } from "@/types/music";

interface RawTrendingItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export function DiscoverPageContent() {
  const { user } = useUser();
  const [userTopArtists, setUserTopArtists] = useState<TopArtist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setTrack = usePlayerStore((s) => s.setTrack);

  const supabase = createSupabaseBrowserClient();

  // Load user data if authenticated
  useEffect(() => {
    if (!user) {
      setUserTopArtists([]);
      setRecentlyPlayed([]);
      return;
    }

    let cancelled = false;
    Promise.all([
      getTopArtists(user.id, 3, supabase).catch(() => []),
      getRecentlyPlayedWithDetails(user.id, supabase, 6).catch(() => []),
    ]).then(([artists, recent]) => {
      if (cancelled) return;
      setUserTopArtists(artists);
      setRecentlyPlayed(recent);
    });

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  // Fetch trending tracks
  useEffect(() => {
    let cancelled = false;

    async function loadTrending() {
      try {
        setLoading(true);
        const res = await fetch("/api/trending", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load trending tracks (${res.status})`);
        }
        const data: RawTrendingItem[] = await res.json();
        if (cancelled) return;

        if (Array.isArray(data)) {
          const tracks: Track[] = data.map((item) => ({
            id: `youtube:${item.videoId}`,
            videoId: item.videoId,
            title: item.title,
            artist: item.channelTitle || "YouTube",
            album: "Trending Hits",
            artwork: item.thumbnail,
            duration: 0,
          }));
          setTrendingTracks(tracks);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[Discover] Failed to fetch trending:", err);
        setTrendingError("Unable to load trending tracks right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute final top 3 artists (using user listening history or trending fallback)
  const displayArtists = useMemo<TopArtist[]>(() => {
    if (userTopArtists.length >= 3) {
      return userTopArtists.slice(0, 3);
    }

    // Fallback: derive top artists from trending tracks
    const fallbackMap = new Map<string, { count: number; artwork?: string }>();
    for (const track of trendingTracks) {
      const name = track.artist.trim();
      if (!name || name.toLowerCase() === "youtube") continue;
      const existing = fallbackMap.get(name);
      if (existing) {
        existing.count += 1;
        if (!existing.artwork && track.artwork) existing.artwork = track.artwork;
      } else {
        fallbackMap.set(name, { count: 1, artwork: track.artwork });
      }
    }

    const fallbackList: TopArtist[] = Array.from(fallbackMap.entries())
      .map(([name, info]) => ({ name, count: info.count, artwork: info.artwork }))
      .sort((a, b) => b.count - a.count);

    // Merge user artists + fallback to make at least 3
    const merged: TopArtist[] = [...userTopArtists];
    const existingNames = new Set(userTopArtists.map((a) => a.name.toLowerCase()));

    for (const fb of fallbackList) {
      if (!existingNames.has(fb.name.toLowerCase())) {
        merged.push(fb);
        existingNames.add(fb.name.toLowerCase());
      }
      if (merged.length >= 3) break;
    }

    return merged.slice(0, 3);
  }, [userTopArtists, trendingTracks]);

  return (
    <div className="route-content discover-page">
      {/* 1. Category Tab Row */}
      <div className="discover-tabs-bar" role="navigation" aria-label="Music categories">
        <Link href="/discover" className="discover-tab discover-tab--active" aria-current="page">
          ✦ Discover
        </Link>
        <Link href="/playlists" className="discover-tab">
          ≡ Playlists
        </Link>
        <Link href="/search" className="discover-tab">
          ⌕ Artists
        </Link>
        <Link href="/search" className="discover-tab">
          🔍 Search
        </Link>
      </div>

      <header className="discover-header">
        <p className="eyebrow">Open frequencies</p>
        <h1 className="route-title">
          <BlurText text="Discover" animateBy="words" direction="top" delay={200} stepDuration={0.6} />
        </h1>
        <p className="route-lede">
          Trending frequencies, heavy rotation, and the artists defining the soundscape.
        </p>
      </header>

      {/* 2. Top 3 Artists Section */}
      <section className="content-section" aria-labelledby="top-artists-heading">
        <SectionHeading
          eyebrow="Heavy rotation"
          title={userTopArtists.length >= 3 ? "Your Top Artists" : "Featured Artists"}
        />
        {displayArtists.length > 0 ? (
          <TopArtistsStack artists={displayArtists} trendingTracks={trendingTracks} />
        ) : loading ? (
          <div className="library-loading">Tuning into artist frequencies…</div>
        ) : null}
      </section>

      {/* 3. Trending Songs Section */}
      <section className="content-section" aria-labelledby="trending-songs-heading">
        <SectionHeading
          eyebrow="Global signals"
          title="Trending Songs"
        />

        {loading && trendingTracks.length === 0 && (
          <div className="library-loading">Loading trending tracks…</div>
        )}

        {trendingError && trendingTracks.length === 0 && (
          <div className="empty-panel catalog-state catalog-state--error">
            <span className="empty-panel__mark" aria-hidden="true">⚠</span>
            <h2>Trending unavailable</h2>
            <p>{trendingError}</p>
          </div>
        )}

        {trendingTracks.length > 0 && (
          <div className="track-list" role="list" aria-label="Trending tracks">
            {trendingTracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`track-card track-card--row${isCurrent ? " track-card--current" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void setTrack(track, trendingTracks)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void setTrack(track, trendingTracks);
                    }
                  }}
                >
                  <div className="track-card__position">
                    {isCurrent && isPlaying ? (
                      <span className="track-card__eq" aria-hidden="true">
                        <span /><span /><span />
                      </span>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
                  <div className="track-card__details">
                    <h3>{track.title}</h3>
                    <p>{track.artist}</p>
                  </div>
                  <div className="track-card__actions" onClick={(e) => e.stopPropagation()}>
                    <LikeButton track={track} size="small" />
                    <AddToPlaylistButton track={track} />
                    <AddToQueueButton track={track} size="small" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Optional "Jump Back In" Section (if user has recent history) */}
      {recentlyPlayed.length > 0 && (
        <section className="content-section" aria-labelledby="recent-heading">
          <SectionHeading
            eyebrow="Listening history"
            title="Jump Back In"
          />
          <div className="jump-back-grid">
            {recentlyPlayed.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`jump-back-card${isCurrent ? " jump-back-card--current" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => void setTrack(track, recentlyPlayed)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void setTrack(track, recentlyPlayed);
                    }
                  }}
                >
                  <ArtworkTile artwork={track.artwork} title={track.title} size="medium" />
                  <div className="jump-back-card__info">
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
