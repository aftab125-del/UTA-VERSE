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
  | { success: true; lyrics: LyricsData; method?: string }
  | { success: false; notFound: boolean; message: string };

const KNOWN_LABELS = new Set([
  "yrf",
  "yrf music",
  "t-series",
  "tseries",
  "t-series apna punjab",
  "t-series bhakti sagar",
  "sony music india",
  "sonymusicindiavevo",
  "sony music",
  "zee music company",
  "zee music",
  "tips official",
  "tips",
  "tips music",
  "saregama",
  "saregama music",
  "speed records",
  "eros now",
  "eros now music",
  "venus",
  "venus music",
  "aditya music",
  "geetha arts",
  "lahari music",
  "think music india",
  "think music",
  "rajshri",
  "times music",
  "white hill music",
  "geet mp3",
  "dm - desi melodies",
  "vyrloriginalsvideo",
  "vyrloriginals",
  "universal music",
  "warner music",
]);

/**
 * Checks if a name is likely a record label or distribution channel rather than a solo artist
 */
export function isLikelyLabelOrChannel(name: string): boolean {
  if (!name) return false;
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (KNOWN_LABELS.has(clean)) return true;
  for (const label of KNOWN_LABELS) {
    if (clean === label.replace(/[^a-z0-9]/g, "")) return true;
  }
  return false;
}

/**
 * Strips common YouTube video/audio noise from titles and channel names
 * to maximize LRCLIB match accuracy.
 */
export function cleanTrackMetadata(
  rawTitle: string,
  rawArtist: string
): { trackName: string; artistName: string; isChannelArtist: boolean } {
  let title = (rawTitle || "").trim();
  let artist = (rawArtist || "").trim();

  // 1. Decode HTML entities
  title = title
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  artist = artist
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

  // 2. Clean artist noise suffixes like " - Topic", "VEVO", "Official", etc.
  artist = artist
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .replace(
      /\s*(?:Official\s*(?:Music\s*)?(?:Channel|Page)?|Channel|Music|Records|Entertainment|Films|Company|Studios)$/i,
      ""
    )
    .trim();

  // 3. Strip pipes early if present:
  // e.g., "Falak Tak Full Song | Tashan | Akshay Kumar | Udit Narayan"
  // e.g., "Haareya Song | Meri Pyaari Bindu | Ayushmann Khurrana | Arijit Singh"
  if (title.includes("|")) {
    const pipeParts = title.split(/\s*\|\s*/);
    title = pipeParts[0].trim();
  }

  // 4. Handle "Artist - Song" or "Song - Movie"
  const dashMatch = title.match(/^(.+?)\s+[-–—:]\s+(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();

    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normLeft = left.toLowerCase().replace(/[^a-z0-9]/g, "");

    // If channel/artist matches left, left is artist
    if (
      !normArtist ||
      normArtist === "youtube" ||
      normLeft.includes(normArtist) ||
      normArtist.includes(normLeft)
    ) {
      artist = left;
      title = right;
    }
  }

  // 5. Clean title: remove quotes e.g. Dominic Fike "Babydoll" -> Babydoll
  const quoteMatch = title.match(/^(.+?)\s+["“](.+?)["”]$/);
  if (quoteMatch) {
    const preQuote = quoteMatch[1].trim();
    const inQuote = quoteMatch[2].trim();
    const normArtist = artist.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normPreQuote = preQuote.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      !normArtist ||
      normArtist === "youtube" ||
      normArtist === normPreQuote ||
      isLikelyLabelOrChannel(normArtist)
    ) {
      artist = preQuote;
      title = inQuote;
    }
  }

  // 6. Remove parenthetical/bracketed noise:
  // (From "Movie"), [From "Movie"], (From Movie)
  title = title.replace(
    /[\(\[\{]\s*(?:from|in|soundtrack|ost)\s+["“'«]?[^()\[\]{}]+?["”'»]?\s*[\)\]\}]/gi,
    ""
  );

  // (Original Version), (Full Song), (Full Audio), (Full Video), etc.
  title = title.replace(
    /[\(\[\{]\s*(?:original\s+(?:version|motion\s+picture\s+soundtrack|mix|audio)|full\s+(?:song|video|audio|track)|audio\s+song|video\s+song|lyrical(?:\s+video|\s+song)?)\s*[\)\]\}]/gi,
    ""
  );

  // Common video/audio tags: (Official Music Video), (Official Audio), (Lyrics), (Visualizer), etc.
  title = title.replace(
    /[\(\[\{]\s*(?:official\s+)?(?:music\s+)?(?:video|audio|visualizer|visuals|lyric\s+video|lyrics|hd|4k|8k|hq|mv|remaster(?:ed)?(?:\s+\d+)?|live(?:\s+performance|\s+at\s+[^)\]}]+)?|explicit|clean|extended(?:\s+mix|\s+version)?)\s*[\)\]\}]/gi,
    ""
  );

  // (feat. X) / (ft. X) in title
  title = title.replace(/[\(\[\{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[\)\]\}]/gi, "");
  title = title.replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, "");
  title = title.replace(/[\(\[\{]\s*prod\.?\s+by\s+[^)\]}]+[\)\]\}]/gi, "");

  // 7. Strip inline YouTube noise words:
  title = title.replace(
    /\b(?:full\s+song|full\s+audio|full\s+video|video\s+song|audio\s+song|lyrical\s+song|lyric\s+video|lyrical\s+video|promo\s+song)\b/gi,
    ""
  );

  // If title ends with " Song" (e.g. "Haareya Song" -> "Haareya"), but keep protected words like "Love Song"
  const protectedSongTitles = new Set([
    "love song",
    "fight song",
    "earth song",
    "swan song",
    "immigrant song",
    "redemption song",
    "the logical song",
    "theme song",
    "drinking song",
    "our song",
  ]);
  if (/\b\w+\s+song$/i.test(title) && !protectedSongTitles.has(title.toLowerCase().trim())) {
    title = title.replace(/\s+song$/i, "");
  }

  // Strip trailing hyphens or movie suffixes: e.g. "Title - Movie"
  title = title.replace(/\s*[-–—]\s*(?:from\s+)?["“'«]?[^"”'»]+["”'»]?$/i, "");

  // Remove stray quotes and clean multiple spaces
  title = title.replace(/["“"”]/g, "").replace(/\s{2,}/g, " ").trim();

  // Strip features from artist as well
  artist = artist
    .replace(/[\(\[\{]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]}]+[\)\]\}]/gi, "")
    .replace(/\s*(?:feat\.?|ft\.?|featuring)\s+[\w\s&,.-]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const isChannel = isLikelyLabelOrChannel(rawArtist) || isLikelyLabelOrChannel(artist);

  return { trackName: title, artistName: artist, isChannelArtist: isChannel };
}

/**
 * Parses synchronized LRC text format into structured timestamps.
 * Supports standard [mm:ss.xx], [offset:ms], and multi-tag lines.
 */
export function parseLrc(lrcContent: string): SyncedLine[] {
  if (!lrcContent || typeof lrcContent !== "string") return [];

  const lines = lrcContent.split("\n");
  const result: SyncedLine[] = [];
  const tagRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  let globalOffsetSeconds = 0;

  // Check for [offset:+/-ms] tag
  for (const rawLine of lines) {
    const offsetMatch = rawLine.trim().match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
      globalOffsetSeconds = parseInt(offsetMatch[1], 10) / 1000;
      break;
    }
  }

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
      timestamps.push(minutes * 60 + seconds + fraction + globalOffsetSeconds);
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "").trim();

    for (const time of timestamps) {
      result.push({ time: Math.max(0, time), text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Checks whether synchronized lyrics can be reliably synchronized to track playback.
 * If timestamps are invalid or wildly mismatch the track duration, returns false
 * so the player displays the lyrics in pure scroll-only mode without forced jumps.
 */
export function isSyncValid(syncedLyrics: SyncedLine[] | null, trackDuration: number): boolean {
  if (!syncedLyrics || syncedLyrics.length < 2) return false;

  const firstTime = syncedLyrics[0].time;
  const lastTime = syncedLyrics[syncedLyrics.length - 1].time;

  // Timestamps must show time progression
  if (lastTime <= firstTime && syncedLyrics.length > 2) return false;

  if (trackDuration > 0) {
    // If the first lyric starts AFTER the entire track ends
    if (firstTime >= trackDuration) return false;

    // If the last lyric is far past the track duration (e.g. full 5:34 album track lyrics on a 3:48 video cut)
    // Allow up to 18 seconds of trailing outro padding
    if (lastTime > trackDuration + 18) {
      return false;
    }

    // If track is long (> 90s), but last lyric ends in first 35% of track (truncated or cut lyrics)
    if (trackDuration > 90 && lastTime < trackDuration * 0.35) {
      return false;
    }
  }

  return true;
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
export async function fetchLyrics(track: Track, audioDuration?: number): Promise<LyricsResponse> {
  const effectiveDuration = audioDuration && audioDuration > 0 ? audioDuration : track.duration || 0;
  const cacheKey = `${track.id || `${track.artist}:${track.title}`}:${Math.round(effectiveDuration)}`;
  const cached = clientLyricsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      title: track.title,
      artist: track.artist,
    });
    if (effectiveDuration > 0) {
      params.set("duration", Math.round(effectiveDuration).toString());
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
