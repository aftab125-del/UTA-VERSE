import Link from "next/link";
import { ArtworkTile } from "@/components/music/artwork-tile";
import type { Album } from "@/types/music";

interface AlbumCardProps {
  album: Album;
}

export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Link className="album-card" href={`/albums/${album.id}`}>
      <ArtworkTile artwork={album.artwork} title={album.title} size="large" />
      <h3>{album.title}</h3>
      <p>{album.artist}</p>
      <span>{album.trackCount} tracks</span>
    </Link>
  );
}
