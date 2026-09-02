"use client";

import { ArtworkTile } from "@/components/music/artwork-tile";
import type { Track } from "@/types/music";
import { usePlayerStore } from "@/stores/player-store";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { BorderGlow } from "@/components/reactbits/BorderGlow";

interface TrackCardProps {
  track: Track;
  variant?: "row" | "tile";
}

export function TrackCard({ track, variant = "row" }: TrackCardProps) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const setTrack = usePlayerStore((state) => state.setTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isCurrent = currentTrack?.id === track.id;

  const card = (
    <article className={`track-card track-card--${variant}${isCurrent ? " track-card--current" : ""}`}>
      <button className="track-card__play" type="button" onClick={() => void setTrack(track)} aria-label={`Play ${track.title} by ${track.artist}`}>
        <ArtworkTile artwork={track.artwork} title={track.title} size={variant === "tile" ? "large" : "small"} />
        <span className="track-card__play-icon" aria-hidden="true">{isCurrent && isPlaying ? "Ⅱ" : "▶"}</span>
      </button>
      <div className="track-card__details">
        <h3>{track.title}</h3>
        <p>{track.artist}</p>
        <span>{track.album}</span>
      </div>
      <span className="track-card__duration">{formatDuration(track.duration)}</span>
    </article>
  );

  const spotlightWrapped = (
    <SpotlightCard spotlightColor="rgba(169, 139, 255, 0.45)">
      {card}
    </SpotlightCard>
  );

  if (isCurrent) {
    return (
      <BorderGlow
        active={isPlaying}
        colors={["#8b5cf6", "#a78bfa", "#c4b5fd"]}
        glowColor="268 100 76"
        borderRadius={8}
      >
        {spotlightWrapped}
      </BorderGlow>
    );
  }

  return spotlightWrapped;
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

