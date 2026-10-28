import { createPlaylist, addTrackToPlaylist, updatePlaylist } from "@/lib/music/playlists";
import { usePlaylistsSummaryStore } from "@/stores/playlists-summary-store";

export interface SpotifyExtractedTrack {
  title: string;
  artist: string;
  durationMs: number;
}

export interface SpotifyExtractResult {
  success: boolean;
  playlistId: string;
  name: string;
  description: string;
  coverUrl: string | null;
  total: number;
  tracks: SpotifyExtractedTrack[];
}

export interface ImportProgress {
  current: number;
  total: number;
  trackLabel: string;
  percent: number;
}

export interface ImportResult {
  playlistId: string;
  name: string;
  coverUrl: string | null;
  totalTracks: number;
  importedTracks: number;
}

interface SearchTrackResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

/**
 * Strips bracketed text like (feat. ...), (with ...), [Official Video] to improve matching accuracy.
 */
function simplifyTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](feat\.|ft\.|with|remastered|version|bonus track).*?[\)\]]/gi, "")
    .replace(/\s*[\(\[](official\s*(music\s*)?video|audio|lyrics|hd|4k)[\)\]]/gi, "")
    .trim();
}

/**
 * Searches for a matching YouTube Music track via the internal /api/search route.
 */
async function findMatchingTrack(title: string, artist: string): Promise<SearchTrackResult | null> {
  const searchCandidates = [
    `${title} ${artist}`.trim(),
    `${simplifyTitle(title)} ${artist}`.trim(),
    title.trim(),
  ];

  // Try each query variant until a valid candidate is found
  const triedQueries = new Set<string>();

  for (const query of searchCandidates) {
    if (!query || triedQueries.has(query)) continue;
    triedQueries.add(query);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) continue;

      const items = (await res.json().catch(() => [])) as SearchTrackResult[];
      if (Array.isArray(items) && items.length > 0 && items[0]?.videoId) {
        return items[0];
      }
    } catch {
      // Continue to next candidate variant
    }
  }

  return null;
}

/**
 * Extracts and imports a Spotify playlist by link into the user's UTA-VERSE library.
 */
export async function importSpotifyPlaylist(
  spotifyUrl: string,
  userId: string = "local-user",
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  // 1. Extract Spotify playlist metadata and track list
  const extractRes = await fetch("/api/spotify/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: spotifyUrl }),
  });

  if (!extractRes.ok) {
    const errorData = await extractRes.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to retrieve Spotify playlist. Please check the link.");
  }

  const data = (await extractRes.json()) as SpotifyExtractResult;

  if (!data.tracks || data.tracks.length === 0) {
    throw new Error("No tracks found in the provided Spotify playlist.");
  }

  // 2. Create the destination playlist in UTA-VERSE
  const created = await createPlaylist(
    userId,
    data.name,
    data.description || "Imported from Spotify"
  );

  // If cover art was extracted, update the playlist cover immediately
  if (data.coverUrl) {
    try {
      await updatePlaylist(created.id, { cover_url: data.coverUrl });
    } catch (err) {
      console.warn("[SpotifyImporter] Could not save initial cover URL:", err);
    }
  }

  // Register in summary store
  usePlaylistsSummaryStore.getState().addPlaylist({
    id: created.id,
    name: created.name,
    trackCount: 0,
  });

  const total = data.tracks.length;
  let importedCount = 0;
  let firstArtwork: string | null = data.coverUrl;

  // 3. Sequentially resolve and add tracks
  for (let i = 0; i < total; i++) {
    const spotifyTrack = data.tracks[i];
    const trackLabel = spotifyTrack.artist
      ? `${spotifyTrack.title} - ${spotifyTrack.artist}`
      : spotifyTrack.title;

    onProgress?.({
      current: i + 1,
      total,
      trackLabel,
      percent: Math.round(((i + 1) / total) * 100),
    });

    try {
      const match = await findMatchingTrack(spotifyTrack.title, spotifyTrack.artist);

      if (match) {
        const durationSec = spotifyTrack.durationMs
          ? Math.round(spotifyTrack.durationMs / 1000)
          : 0;

        const artwork = match.thumbnail || data.coverUrl || "";
        if (!firstArtwork && artwork) firstArtwork = artwork;

        await addTrackToPlaylist(
          created.id,
          match.videoId,
          {
            title: match.title || spotifyTrack.title,
            artist: match.channelTitle || spotifyTrack.artist || "Unknown artist",
            artwork,
            duration: durationSec,
          },
          importedCount
        );

        importedCount++;
        usePlaylistsSummaryStore.getState().incrementTrackCount(created.id);
      }
    } catch (err) {
      console.warn(`[SpotifyImporter] Failed adding track "${trackLabel}":`, err);
    }

    // Brief 40ms pause between queries to yield to UI and avoid network thrashing
    await new Promise((r) => setTimeout(r, 40));
  }

  // 4. Ensure cover artwork is persisted if tracks had thumbnails
  if (firstArtwork && !data.coverUrl) {
    try {
      await updatePlaylist(created.id, { cover_url: firstArtwork });
    } catch {
      // ignore
    }
  }

  // Trigger a store refresh so all components reflect the final track count
  void usePlaylistsSummaryStore.getState().load(userId, true);

  return {
    playlistId: created.id,
    name: created.name,
    coverUrl: data.coverUrl || firstArtwork,
    totalTracks: total,
    importedTracks: importedCount,
  };
}
