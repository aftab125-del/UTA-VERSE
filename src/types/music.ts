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
