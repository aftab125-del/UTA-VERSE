"use client";

import { useState, type CSSProperties } from "react";

interface ArtworkTileProps {
  artwork: string;
  title: string;
  circular?: boolean;
  size?: "small" | "medium" | "large";
}

function isImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  );
}

export function ArtworkTile({ artwork, title, circular = false, size = "medium" }: ArtworkTileProps) {
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const isImage = artwork !== failedArtwork && isImageUrl(artwork);

  return (
    <div
      className={`artwork-tile artwork-tile--${size}${circular ? " artwork-tile--circular" : ""}`}
      style={!isImage && artwork ? ({ "--artwork": artwork } as CSSProperties) : undefined}
      role="img"
      aria-label={`${title} artwork`}
    >
      {isImage ? (
        <img
          src={artwork}
          alt=""
          className="artwork-tile__img"
          loading="lazy"
          onError={() => setFailedArtwork(artwork)}
        />
      ) : (
        <span aria-hidden="true">{title ? title.slice(0, 1) : "♪"}</span>
      )}
    </div>
  );
}
