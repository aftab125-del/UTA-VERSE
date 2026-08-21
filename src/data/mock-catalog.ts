import type { Album, Artist, Track } from "@/types/music";

const artwork = {
  violet: "linear-gradient(135deg, #21134e 0%, #7545e8 48%, #191a42 100%)",
  blue: "linear-gradient(135deg, #10164b 0%, #3730c9 52%, #10131f 100%)",
  silver: "linear-gradient(135deg, #373b4a 0%, #afafaf 48%, #171a23 100%)",
  charcoal: "linear-gradient(135deg, #29292b 0%, #5a5b68 45%, #101116 100%)",
};

export const mockTracks: Track[] = [
  { id: "track-night-transit", title: "Night Transit", artist: "UTA-VERSE Radio", album: "Afterimage", artwork: artwork.violet, duration: 218 },
  { id: "track-static-bloom", title: "Static Bloom", artist: "Lumen Field", album: "Signal / Noise", artwork: artwork.blue, duration: 196 },
  { id: "track-silver-line", title: "Silver Line", artist: "Mara Vale", album: "Soft Frequency", artwork: artwork.silver, duration: 244 },
  { id: "track-low-orbit", title: "Low Orbit", artist: "Aster House", album: "Gravity Studies", artwork: artwork.charcoal, duration: 231 },
  { id: "track-quiet-current", title: "Quiet Current", artist: "Nocturne FM", album: "Open Skies", artwork: artwork.blue, duration: 207 },
  { id: "track-lucid-weather", title: "Lucid Weather", artist: "Mara Vale", album: "Soft Frequency", artwork: artwork.violet, duration: 264 },
];

export const mockAlbums: Album[] = [
  { id: "album-afterimage", title: "Afterimage", artist: "UTA-VERSE Radio", artwork: artwork.violet, trackCount: 12 },
  { id: "album-signal-noise", title: "Signal / Noise", artist: "Lumen Field", artwork: artwork.blue, trackCount: 9 },
  { id: "album-soft-frequency", title: "Soft Frequency", artist: "Mara Vale", artwork: artwork.silver, trackCount: 10 },
  { id: "album-gravity-studies", title: "Gravity Studies", artist: "Aster House", artwork: artwork.charcoal, trackCount: 8 },
];

export const mockArtists: Artist[] = [
  { id: "artist-uta-verse-radio", name: "UTA-VERSE Radio", artwork: artwork.violet, genre: "Ambient electronic" },
  { id: "artist-lumen-field", name: "Lumen Field", artwork: artwork.blue, genre: "Future soul" },
  { id: "artist-mara-vale", name: "Mara Vale", artwork: artwork.silver, genre: "Dream pop" },
  { id: "artist-aster-house", name: "Aster House", artwork: artwork.charcoal, genre: "Instrumental" },
];

export const mockRecentlyPlayed = mockTracks.slice(2, 6);
export const mockTrending = mockTracks.slice(0, 5);
export const mockRecommended = mockTracks.slice(1, 5);
