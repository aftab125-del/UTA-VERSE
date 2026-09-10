import type { Track } from "@/types/music";

export interface SyncedLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  id?: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: SyncedLine[] | null;
  rawSyncedLyrics: string | null;
  source: "lrclib";
}

export type LyricsResponse =
  | { success: true; lyrics: LyricsData }
  | { success: false; notFound: boolean; message: string };

/**
 * Strips common YouTube video/audio noise from titles and channel names
 * to maximize LRCLIB match accuracy.
 */
export function cleanTrackMetadata(
  rawTitle: string,
  rawArtist: string
): { trackName: string; artistName: string } {
  let title = (rawTitle || "").trim();
  let artist = (rawArtist || "").trim();

  // Strip common artist noise suffixes like " - Topic", "VEVO"
  artist = artist
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();

  // If title has "Artist - Song", extract them
  const dashMatch = title.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
  if (dashMatch) {
    const potentialArtist = dashMatch[1].trim();
    const potentialTitle = dashMatch[2].trim();

    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normPotential = potentialArtist.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      !normArtist ||
      normArtist === "youtube" ||
      normPotential.includes(normArtist) ||
      normArtist.includes(normPotential)
    ) {
      artist = potentialArtist;
      title = potentialTitle;
    }
  }

  // Clean title: remove quotes e.g. Dominic Fike "Babydoll" -> Babydoll
  const quoteMatch = title.match(/^(.+?)\s+["“](.+?)["”]$/);
  if (quoteMatch) {
    const preQuote = quoteMatch[1].trim();
    const inQuote = quoteMatch[2].trim();
    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normPreQuote = preQuote.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (!normArtist || normArtist === "youtube" || normArtist === normPreQuote) {
      artist = preQuote;
      title = inQuote;
    }
  }

  // Remove common parenthetical/bracketed noise in title:
  // (Official Music Video), [Official Video], (Audio), (Lyric Video), (Lyrics), (Visualizer), etc.
  title = title
    .replace(
      /[\(\[\{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|lyric\s+video|lyrics|hd|4k|mv|remastered|live|explicit)\s*[\)\]\}]/gi,
      ""
    )
    .replace(/[\(\[\{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[\)\]\}]/gi, "")
    .replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, "")
    .replace(/[\(\[\{]\s*prod\.?\s+by\s+[^)\]}]+[\)\]\}]/gi, "")
    .replace(/["“"”]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Strip feature mentions from artist name as well for cleaner lookup
  artist = artist
    .replace(/[\(\[\{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[\)\]\}]/gi, "")
    .replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, "")
    .trim();

  return { trackName: title, artistName: artist };
}

/**
 * Parses synchronized LRC text format into structured timestamps.
 * Supports standard [mm:ss.xx] and multi-tag lines.
 */
export function parseLrc(lrcContent: string): SyncedLine[] {
  if (!lrcContent || typeof lrcContent !== "string") return [];

  const lines = lrcContent.split("\n");
  const result: SyncedLine[] = [];
  const tagRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fractionStr = match[3] || "0";
      const fraction =
        fractionStr.length === 3 ? parseInt(fractionStr, 10) / 1000 : parseInt(fractionStr, 10) / 100;
      timestamps.push(minutes * 60 + seconds + fraction);
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "").trim();

    for (const time of timestamps) {
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Binary search to find the active lyric index for currentTime in seconds.
 * Returns -1 if playback is before the first timestamp.
 */
export function findCurrentLyricIndex(syncedLyrics: SyncedLine[], currentTime: number): number {
  if (!syncedLyrics.length || currentTime < syncedLyrics[0].time) {
    return -1;
  }

  let low = 0;
  let high = syncedLyrics.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (syncedLyrics[mid].time <= currentTime) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return candidate;
}

// Client-side in-memory cache to prevent repeated fetches during session
const clientLyricsCache = new Map<string, LyricsResponse>();

/**
 * Fetches lyrics for a track via the internal /api/lyrics proxy.
 */
export async function fetchLyrics(track: Track): Promise<LyricsResponse> {
  const cacheKey = track.id || `${track.artist}:${track.title}`;
  const cached = clientLyricsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      title: track.title,
      artist: track.artist,
    });
    if (track.duration && track.duration > 0) {
      params.set("duration", Math.round(track.duration).toString());
    }

    const response = await fetch(`/api/lyrics?${params.toString()}`);
    const data = (await response.json()) as LyricsResponse;

    clientLyricsCache.set(cacheKey, data);
    return data;
  } catch (error) {
    const errorResponse: LyricsResponse = {
      success: false,
      notFound: false,
      message: error instanceof Error ? error.message : "Failed to load lyrics",
    };
    return errorResponse;
  }
}
