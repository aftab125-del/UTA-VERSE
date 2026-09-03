export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  audioUrl?: string;
  videoId?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  trackCount: number;
}

export interface Artist {
  id: string;
  name: string;
  artwork: string;
  genre: string;
  bio?: string;
}

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  folderId: string | null;
  isPublic: boolean;
  trackCount: number;
  totalDuration: number;
  createdAt: string;
}

export interface PlaylistWithTracks extends Playlist {
  tracks: Track[];
}

export interface PlaylistFolder {
  id: string;
  userId: string;
  name: string;
  position: number;
  createdAt: string;
}

export interface LikedTrack {
  trackId: string;
  likedAt: string;
}

export interface ListeningHistoryEntry {
  trackId: string;
  playedAt: string;
  progressMs: number;
}
