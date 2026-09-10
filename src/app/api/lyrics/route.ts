import { NextResponse } from "next/server";
import { cleanTrackMetadata, parseLrc, type LyricsData, type LyricsResponse } from "@/lib/music/lyrics";

export const runtime = "nodejs";

interface CacheEntry {
  data: LyricsResponse;
  expiresAt: number;
}

// In-memory cache for server-side deduplication
const serverCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOT_FOUND_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function pruneCacheIfNeeded() {
  if (serverCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, entry] of serverCache.entries()) {
      if (entry.expiresAt < now) {
        serverCache.delete(key);
      }
    }
    // If still over limit, delete oldest 200 entries
    if (serverCache.size > MAX_CACHE_SIZE) {
      let count = 0;
      for (const key of serverCache.keys()) {
        serverCache.delete(key);
        count++;
        if (count >= 200) break;
      }
    }
  }
}

interface LrclibTrackResponse {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

function scoreCandidate(
  candidate: LrclibTrackResponse,
  targetTitle: string,
  targetArtist?: string,
  targetDuration?: number
): number {
  let score = 0;

  // 1. Synced lyrics priority
  if (candidate.syncedLyrics) {
    score += 100;
  } else if (candidate.plainLyrics || candidate.instrumental) {
    score += 30;
  } else {
    return -999; // Reject candidate without any lyrics or instrumental flag
  }

  const candTitle = (candidate.trackName || candidate.name || "").toLowerCase().trim();
  const tgtTitle = targetTitle.toLowerCase().trim();

  const normCandTitle = candTitle.replace(/[^a-z0-9]/g, "");
  const normTgtTitle = tgtTitle.replace(/[^a-z0-9]/g, "");

  // 2. Title similarity
  if (normCandTitle && normTgtTitle) {
    if (normCandTitle === normTgtTitle) {
      score += 50;
    } else if (normCandTitle.includes(normTgtTitle) || normTgtTitle.includes(normCandTitle)) {
      score += 30;
    } else {
      const tgtWords = tgtTitle.split(/\s+/).filter((w) => w.length > 2);
      const matched = tgtWords.filter((w) => candTitle.includes(w));
      if (matched.length > 0) {
        score += Math.min(25, matched.length * 10);
      }
    }
  }

  // 3. Artist similarity (if artist is known and provided)
  if (targetArtist && candidate.artistName) {
    const candArtist = candidate.artistName.toLowerCase().trim();
    const tgtArtist = targetArtist.toLowerCase().trim();
    const normCandArtist = candArtist.replace(/[^a-z0-9]/g, "");
    const normTgtArtist = tgtArtist.replace(/[^a-z0-9]/g, "");

    if (normCandArtist && normTgtArtist) {
      if (normCandArtist === normTgtArtist) {
        score += 40;
      } else if (candArtist.includes(tgtArtist) || tgtArtist.includes(candArtist)) {
        score += 25;
      } else {
        const tgtArtWords = tgtArtist.split(/\s+/).filter((w) => w.length > 2);
        const matched = tgtArtWords.filter((w) => candArtist.includes(w));
        if (matched.length > 0) {
          score += Math.min(20, matched.length * 10);
        }
      }
    }
  }

  // 4. Duration proximity tolerance (within 5-10s reasonable leeway)
  if (targetDuration && targetDuration > 0 && candidate.duration && candidate.duration > 0) {
    const diff = Math.abs(candidate.duration - targetDuration);
    if (diff <= 3) {
      score += 30;
    } else if (diff <= 8) {
      score += 20;
    } else if (diff <= 15) {
      score += 10;
    } else if (diff <= 30) {
      score += 0;
    } else if (diff > 60) {
      score -= 30;
    }
  }

  return score;
}

function pickBestCandidate(
  candidates: LrclibTrackResponse[],
  targetTitle: string,
  targetArtist?: string,
  targetDuration?: number
): LrclibTrackResponse | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best: LrclibTrackResponse | null = null;
  let bestScore = -Infinity;

  for (const item of candidates) {
    const s = scoreCandidate(item, targetTitle, targetArtist, targetDuration);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }

  return bestScore > 0 ? best : null;
}

interface QueryResult {
  item: LrclibTrackResponse | null;
  method: string;
}

async function queryLrclib(
  trackName: string,
  artistName: string,
  isChannelArtist: boolean,
  duration?: number
): Promise<QueryResult> {
  const headers = {
    "User-Agent": "UTA-VERSE Music (https://github.com/aftab125-del/UTA-VERSE)",
  };

  let fallbackPlain: LrclibTrackResponse | null = null;
  let fallbackMethod = "";

  const checkSynced = (item: LrclibTrackResponse | null, method: string) => {
    if (item && item.syncedLyrics) {
      return { item, method };
    }
    if (item && (item.plainLyrics || item.instrumental) && !fallbackPlain) {
      fallbackPlain = item;
      fallbackMethod = method;
    }
    return null;
  };

  // Tier 1: Try exact match /api/get (only if artist is not a generic channel/label)
  if (!isChannelArtist && artistName && trackName) {
    try {
      const getParams = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
      });
      if (duration && duration > 0) {
        getParams.set("duration", Math.round(duration).toString());
      }

      const getRes = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });

      if (getRes.ok) {
        const item = (await getRes.json()) as LrclibTrackResponse;
        const hit = checkSynced(item, "exact match (/api/get)");
        if (hit) return hit;
      }
    } catch {
      // Continue to next tier
    }
  }

  // Tier 2: Try structured search /api/search?track_name=...&artist_name=...
  if (!isChannelArtist && artistName && trackName) {
    try {
      const searchParams = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
      });

      const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });

      if (searchRes.ok) {
        const list = (await searchRes.json()) as LrclibTrackResponse[];
        const best = pickBestCandidate(list, trackName, artistName, duration);
        const hit = checkSynced(best, "search (track + artist)");
        if (hit) return hit;
      }
    } catch {
      // Continue to next tier
    }
  }

  // Tier 3: Try general query search /api/search?q=...
  if (!isChannelArtist && artistName && trackName) {
    try {
      const query = `${artistName} ${trackName}`.trim();
      const queryRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });

      if (queryRes.ok) {
        const list = (await queryRes.json()) as LrclibTrackResponse[];
        const best = pickBestCandidate(list, trackName, artistName, duration);
        const hit = checkSynced(best, "search (combined query q)");
        if (hit) return hit;
      }
    } catch {
      // Continue to next tier
    }
  }

  // Tier 4: Fallback to track_name alone (critical for YouTube channel uploads like T-Series/YRF or previous misses)
  if (trackName) {
    // 4a. /api/search?track_name=...
    try {
      const trackRes = await fetch(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}`,
        {
          headers,
          signal: AbortSignal.timeout(4000),
        }
      );

      if (trackRes.ok) {
        const list = (await trackRes.json()) as LrclibTrackResponse[];
        const best = pickBestCandidate(list, trackName, undefined, duration);
        const hit = checkSynced(best, "search (title-only track_name)");
        if (hit) return hit;
      }
    } catch {
      // Continue to 4b
    }

    // 4b. /api/search?q=...
    try {
      const qRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(trackName)}`,
        {
          headers,
          signal: AbortSignal.timeout(4000),
        }
      );

      if (qRes.ok) {
        const list = (await qRes.json()) as LrclibTrackResponse[];
        const best = pickBestCandidate(list, trackName, undefined, duration);
        const hit = checkSynced(best, "search (title-only query q)");
        if (hit) return hit;
      }
    } catch {
      // End of search tiers
    }
  }

  if (fallbackPlain) {
    return {
      item: fallbackPlain,
      method: `${fallbackMethod || "search"} (plain fallback)`,
    };
  }

  return { item: null, method: "none" };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawTitle = url.searchParams.get("title")?.trim() ?? "";
  const rawArtist = url.searchParams.get("artist")?.trim() ?? "";
  const durationParam = url.searchParams.get("duration");
  const duration = durationParam ? parseFloat(durationParam) : undefined;

  if (!rawTitle) {
    return NextResponse.json(
      { success: false, notFound: true, message: "Missing track title." },
      { status: 400 }
    );
  }

  const { trackName, artistName, isChannelArtist } = cleanTrackMetadata(rawTitle, rawArtist);
  const cacheKey = `${artistName.toLowerCase()}:::${trackName.toLowerCase()}`;

  // Check cache (only serve cached if it has synced lyrics)
  const cached = serverCache.get(cacheKey);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.data.success &&
    cached.data.lyrics?.syncedLyrics
  ) {
    return NextResponse.json(cached.data, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  }

  try {
    const { item, method } = await queryLrclib(
      trackName,
      artistName,
      isChannelArtist,
      duration
    );

    if (!item || (!item.plainLyrics && !item.syncedLyrics && !item.instrumental)) {
      console.log(
        `[LyricsAPI] LRCLIB: No lyrics found for "${trackName}" by "${artistName}" after exhausting all 4 tiers.`
      );
      const notFoundPayload: LyricsResponse = {
        success: false,
        notFound: true,
        message: "No lyrics found for this track.",
      };

      pruneCacheIfNeeded();
      serverCache.set(cacheKey, {
        data: notFoundPayload,
        expiresAt: Date.now() + NOT_FOUND_TTL_MS,
      });

      return NextResponse.json(notFoundPayload, { status: 404 });
    }

    console.log(
      `[LyricsAPI] LRCLIB: Hit via ${method} for "${item.trackName || item.name || trackName}" by "${item.artistName || artistName}" (synced: ${Boolean(item.syncedLyrics)})`
    );

    const parsedSynced = item.syncedLyrics ? parseLrc(item.syncedLyrics) : null;

    const lyricsData: LyricsData = {
      id: item.id,
      trackName: item.trackName || item.name || trackName,
      artistName: item.artistName || artistName,
      albumName: item.albumName,
      duration: item.duration,
      instrumental: Boolean(item.instrumental),
      plainLyrics: item.plainLyrics || null,
      syncedLyrics: parsedSynced,
      rawSyncedLyrics: item.syncedLyrics || null,
      source: "lrclib",
    };

    const successPayload: LyricsResponse = {
      success: true,
      lyrics: lyricsData,
      method,
    };

    pruneCacheIfNeeded();
    serverCache.set(cacheKey, {
      data: successPayload,
      expiresAt: Date.now() + SUCCESS_TTL_MS,
    });

    return NextResponse.json(successPayload, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[LyricsAPI] Error fetching lyrics:", err);
    return NextResponse.json(
      {
        success: false,
        notFound: false,
        message: err instanceof Error ? err.message : "Failed to fetch lyrics",
      },
      { status: 502 }
    );
  }
}
