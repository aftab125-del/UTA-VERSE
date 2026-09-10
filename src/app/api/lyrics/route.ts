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

async function queryLrclib(
  trackName: string,
  artistName: string,
  duration?: number
): Promise<LrclibTrackResponse | null> {
  const headers = {
    "User-Agent": "UTA-VERSE Music (https://github.com/aftab125-del/UTA-VERSE)",
  };

  let fallbackPlain: LrclibTrackResponse | null = null;

  // 1. Try exact match /api/get
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
      signal: AbortSignal.timeout(5000),
    });

    if (getRes.ok) {
      const item = (await getRes.json()) as LrclibTrackResponse;
      if (item && item.syncedLyrics) {
        return item; // Has synchronized lyrics!
      }
      if (item && (item.plainLyrics || item.instrumental)) {
        fallbackPlain = item;
      }
    }
  } catch {
    // Continue to fallback search
  }

  // 2. Try structured search /api/search?track_name=...&artist_name=...
  try {
    const searchParams = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (searchRes.ok) {
      const list = (await searchRes.json()) as LrclibTrackResponse[];
      if (Array.isArray(list) && list.length > 0) {
        const withSynced = list.find((item) => item.syncedLyrics);
        if (withSynced) return withSynced;
        if (!fallbackPlain) {
          const withPlain = list.find((item) => item.plainLyrics || item.instrumental);
          if (withPlain) fallbackPlain = withPlain;
        }
      }
    }
  } catch {
    // Continue to fallback search
  }

  // 3. Fallback general query /api/search?q=...
  try {
    const query = `${artistName} ${trackName}`.trim();
    const queryRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (queryRes.ok) {
      const list = (await queryRes.json()) as LrclibTrackResponse[];
      if (Array.isArray(list) && list.length > 0) {
        const withSynced = list.find((item) => item.syncedLyrics);
        if (withSynced) return withSynced;
        if (!fallbackPlain) {
          const withPlain = list.find((item) => item.plainLyrics || item.instrumental);
          if (withPlain) fallbackPlain = withPlain;
        }
      }
    }
  } catch {
    // Search failed
  }

  return fallbackPlain;
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

  const { trackName, artistName } = cleanTrackMetadata(rawTitle, rawArtist);
  const cacheKey = `${artistName.toLowerCase()}:::${trackName.toLowerCase()}`;

  // Check cache (only serve cached if it has synced lyrics or is fresh notFound)
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
    const item = await queryLrclib(trackName, artistName, duration);

    if (!item || (!item.plainLyrics && !item.syncedLyrics && !item.instrumental)) {
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
