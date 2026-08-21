import type { CSSProperties } from "react";

interface ArtworkTileProps {
  artwork: string;
  title: string;
  circular?: boolean;
  size?: "small" | "medium" | "large";
}

export function ArtworkTile({ artwork, title, circular = false, size = "medium" }: ArtworkTileProps) {
  return (
    <div
      className={`artwork-tile artwork-tile--${size}${circular ? " artwork-tile--circular" : ""}`}
      style={{ "--artwork": artwork } as CSSProperties}
      role="img"
      aria-label={`${title} artwork`}
    >
      <span aria-hidden="true">{title.slice(0, 1)}</span>
    </div>
  );
}
