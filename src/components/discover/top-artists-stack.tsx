"use client";

import { usePlayerStore } from "@/stores/player-store";
import type { TopArtist, Track } from "@/types/music";

interface TopArtistsStackProps {
  artists: TopArtist[];
  trendingTracks?: Track[];
}

export function TopArtistsStack({ artists, trendingTracks = [] }: TopArtistsStackProps) {
  const setTrack = usePlayerStore((s) => s.setTrack);

  if (!artists || artists.length === 0) return null;

  // Ensure we display up to 3 artists
  const topThree = artists.slice(0, 3);

  const rotations = [-6, 0, 6];

  const handleArtistClick = (artist: TopArtist) => {
    // Find first matching track in trending or initiate playback
    const matchingTrack = trendingTracks.find((t) =>
      t.artist.toLowerCase().includes(artist.name.toLowerCase()) ||
      artist.name.toLowerCase().includes(t.artist.toLowerCase())
    );

    if (matchingTrack) {
      void setTrack(matchingTrack, trendingTracks);
    } else if (trendingTracks.length > 0) {
      // Fallback: play top trending track
      void setTrack(trendingTracks[0], trendingTracks);
    }
  };

  return (
    <div className="fanned-stack-wrapper">
      <div className="fanned-stack" role="list" aria-label="Top artists">
        {topThree.map((artist, index) => {
          const rotation = rotations[index] ?? 0;
          const zIndex = index + 1;
          const rank = index + 1;

          return (
            <div
              key={artist.name}
              role="listitem"
              className={`fanned-card fanned-card--${index}`}
              style={{
                "--card-rot": `${rotation}deg`,
                "--card-z": zIndex,
              } as React.CSSProperties}
              onClick={() => handleArtistClick(artist)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleArtistClick(artist);
                }
              }}
              aria-label={`Artist #${rank}: ${artist.name}`}
            >
              <div className="fanned-card__inner">
                {artist.artwork ? (
                  <div
                    className="fanned-card__bg"
                    style={{ backgroundImage: `url(${artist.artwork})` }}
                  />
                ) : (
                  <div className="fanned-card__bg fanned-card__bg--placeholder" />
                )}
                <div className="fanned-card__gradient" />

                <div className="fanned-card__badge">#{rank}</div>

                <div className="fanned-card__content">
                  <span className="fanned-card__label">
                    {artist.count > 1 ? `${artist.count} plays` : "Top Artist"}
                  </span>
                  <h3 className="fanned-card__name">{artist.name}</h3>
                  <div className="fanned-card__play-indicator" aria-hidden="true">
                    <span>▶ Play</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
