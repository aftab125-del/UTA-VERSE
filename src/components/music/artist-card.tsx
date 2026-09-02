import Link from "next/link";
import { ArtworkTile } from "@/components/music/artwork-tile";
import type { Artist } from "@/types/music";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <SpotlightCard spotlightColor="rgba(169, 139, 255, 0.45)">
      <Link className="artist-card" href={`/artists/${artist.id}`}>
        <ArtworkTile artwork={artist.artwork} title={artist.name} circular size="medium" />
        <h3>{artist.name}</h3>
        <p>{artist.genre}</p>
      </Link>
    </SpotlightCard>
  );
}
