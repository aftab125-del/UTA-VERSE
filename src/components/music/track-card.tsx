"use client";

import { ArtworkTile } from "@/components/music/artwork-tile";
import { LikeButton, AddToPlaylistButton } from "@/components/ui/track-actions";
import { ContextMenu } from "@/components/ui/context-menu";
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
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const playNext = usePlayerStore((state) => state.playNext);
  const isCurrent = currentTrack?.id === track.id;

  const contextActions = [
    { label: "Play next", icon: "→", onClick: () => playNext(track) },
    { label: "Add to queue", icon: "≡", onClick: () => addToQueue(track) },
  ];

  const card = (
    <ContextMenu actions={contextActions}>
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
        <div className="track-card__actions">
          <LikeButton track={track} />
          <AddToPlaylistButton track={track} />
          <span className="track-card__duration">{formatDuration(track.duration)}</span>
        </div>
      </article>
    </ContextMenu>
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
