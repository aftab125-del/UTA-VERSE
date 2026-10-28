/**
 * InnerTube API Client for YouTube Music
 * Direct, quota-free access to music search, suggestions, and trending charts.
 * Modelled after Echo Music's InnerTube architecture.
 */

export interface InnerTubeTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: number;
  album?: string;
  isSynced?: boolean;
}

const INNERTUBE_BASE_URL = "https://music.youtube.com/youtubei/v1";

const INNERTUBE_CLIENT_CONTEXT = {
  client: {
    clientName: "WEB_REMIX",
    clientVersion: "1.20260213.01.00",
    hl: "en",
    gl: "US",
  },
};

const COMMON_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Origin: "https://music.youtube.com",
  Referer: "https://music.youtube.com/",
  "X-YouTube-Client-Name": "67",
  "X-YouTube-Client-Version": "1.20260213.01.00",
};

/**
 * Normalizes thumbnails to crisp 544x544 resolution.
 */
function upgradeThumbnail(url: string | undefined): string {
  if (!url) return "";
  if (url.includes("googleusercontent.com")) {
    return url.replace(/=w\d+-h\d+.*$/, "=w544-h544-l90-rj");
  }
  if (url.includes("i.ytimg.com")) {
    return url.replace(/hqdefault\.jpg.*$/, "hqdefault.jpg");
  }
  return url;
}

/**
 * Parses time format like "3:22" or "1:02:15" into seconds.
 */
function parseDurationText(text: string | undefined): number {
  if (!text) return 0;
  const parts = text.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

interface InnerTubeFlexColumn {
  musicResponsiveListItemFlexColumnRenderer?: {
    text?: {
      runs?: Array<{
        text: string;
        navigationEndpoint?: unknown;
      }>;
    };
  };
}

interface InnerTubeItemRenderer {
  playlistItemData?: { videoId?: string };
  overlay?: {
    musicItemThumbnailOverlayRenderer?: {
      content?: {
        musicPlayButtonRenderer?: {
          playNavigationEndpoint?: {
            watchEndpoint?: { videoId?: string };
          };
        };
      };
    };
  };
  navigationEndpoint?: {
    watchEndpoint?: { videoId?: string };
  };
  flexColumns?: InnerTubeFlexColumn[];
  thumbnail?: {
    musicThumbnailRenderer?: {
      thumbnail?: {
        thumbnails?: Array<{ url: string; width: number; height: number }>;
      };
    };
  };
}

/**
 * Extracts a structured InnerTubeTrack from a musicResponsiveListItemRenderer.
 */
function parseMusicResponsiveListItem(raw: unknown): InnerTubeTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as InnerTubeItemRenderer;

  const videoId =
    item.playlistItemData?.videoId ||
    item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    item.navigationEndpoint?.watchEndpoint?.videoId;

  if (!videoId) return null;

  const col0Runs = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
  const col1Runs = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];

  const title = col0Runs.map((r) => r.text).join("").trim();
  if (!title) return null;

  // In Column 1, text runs usually follow: Artist • Album • Duration OR Artist • Views
  // Runs before the first bullet " • " represent the artist.
  const artistParts: string[] = [];
  const afterBulletParts: string[] = [];
  let foundBullet = false;

  for (const run of col1Runs) {
    const text = run.text.trim();
    if (text === "•" || text === "• ") {
      foundBullet = true;
      continue;
    }
    if (!foundBullet) {
      if (text) artistParts.push(text);
    } else {
      if (text) afterBulletParts.push(text);
    }
  }

  const channelTitle = artistParts.join(" ").trim() || "Unknown Artist";
  let album: string | undefined;
  let duration = 0;

  for (const part of afterBulletParts) {
    const parsedDur = parseDurationText(part);
    if (parsedDur > 0 && duration === 0) {
      duration = parsedDur;
    } else if (!album && !/^\d+(\.\d+)?[MBK]?\s*(views|plays)?$/i.test(part)) {
      album = part;
    }
  }

  const thumbnails = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  const rawThumb = thumbnails?.length ? thumbnails[thumbnails.length - 1]?.url : "";
  const thumbnail = upgradeThumbnail(rawThumb);

  return {
    videoId,
    title,
    channelTitle,
    thumbnail,
    duration,
    album,
  };
}

/**
 * Searches YouTube Music songs directly via InnerTube without consuming any Google Cloud API quota.
 */
export async function searchInnerTubeSongs(query: string): Promise<InnerTubeTrack[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const response = await fetch(`${INNERTUBE_BASE_URL}/search`, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        context: INNERTUBE_CLIENT_CONTEXT,
        query: cleanQuery,
        // Parameter restricting search strictly to official songs (Echo Music WEB_REMIX filter)
        params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[InnerTube] Search request failed with status ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const contents =
      payload?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

    if (!Array.isArray(contents)) return [];

    const tracks: InnerTubeTrack[] = [];
    const seenVideoIds = new Set<string>();

    for (const section of contents) {
      const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
      const shelfContents = shelf?.contents;
      if (!Array.isArray(shelfContents)) continue;

      for (const entry of shelfContents) {
        const itemRenderer = entry?.musicResponsiveListItemRenderer;
        if (!itemRenderer) continue;

        const track = parseMusicResponsiveListItem(itemRenderer);
        if (track && !seenVideoIds.has(track.videoId)) {
          seenVideoIds.add(track.videoId);
          tracks.push(track);
        }
      }
    }

    // Fallback: If filtered search returns few or no results, attempt broader search without params
    if (tracks.length === 0) {
      const fallbackRes = await fetch(`${INNERTUBE_BASE_URL}/search`, {
        method: "POST",
        headers: COMMON_HEADERS,
        body: JSON.stringify({
          context: INNERTUBE_CLIENT_CONTEXT,
          query: cleanQuery,
        }),
        cache: "no-store",
      });

      if (fallbackRes.ok) {
        const fbPayload = await fallbackRes.json();
        const fbContents =
          fbPayload?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

        if (Array.isArray(fbContents)) {
          for (const section of fbContents) {
            const shelf = section?.musicShelfRenderer || section?.musicCardShelfRenderer;
            const shelfContents = shelf?.contents;
            if (!Array.isArray(shelfContents)) continue;

            for (const entry of shelfContents) {
              const itemRenderer = entry?.musicResponsiveListItemRenderer;
              if (!itemRenderer) continue;

              const track = parseMusicResponsiveListItem(itemRenderer);
              if (track && !seenVideoIds.has(track.videoId)) {
                seenVideoIds.add(track.videoId);
                tracks.push(track);
              }
            }
          }
        }
      }
    }

    return tracks;
  } catch (error) {
    console.error("[InnerTube] Search error:", error);
    return [];
  }
}

/**
 * Retrieves real-time autocomplete suggestions from YouTube Music.
 */
export async function getInnerTubeSearchSuggestions(query: string): Promise<string[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const response = await fetch(`${INNERTUBE_BASE_URL}/music/get_search_suggestions`, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        context: INNERTUBE_CLIENT_CONTEXT,
        input: cleanQuery,
      }),
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = await response.json();
    const suggestionsSection = payload?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents;
    if (!Array.isArray(suggestionsSection)) return [];

    const suggestions: string[] = [];
    for (const item of suggestionsSection) {
      const runs = item?.searchSuggestionRenderer?.suggestion?.runs;
      if (Array.isArray(runs)) {
        const text = runs.map((r: { text: string }) => r.text).join("").trim();
        if (text && !suggestions.includes(text)) {
          suggestions.push(text);
        }
      }
    }

    return suggestions.slice(0, 8);
  } catch (error) {
    console.error("[InnerTube] Suggestions error:", error);
    return [];
  }
}

/**
 * Fetches real trending music tracks and top music videos via InnerTube's explore browse endpoint.
 */
export async function getInnerTubeTrending(): Promise<InnerTubeTrack[]> {
  try {
    const response = await fetch(`${INNERTUBE_BASE_URL}/browse`, {
      method: "POST",
      headers: COMMON_HEADERS,
      body: JSON.stringify({
        context: INNERTUBE_CLIENT_CONTEXT,
        browseId: "FEmusic_explore",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[InnerTube] Explore browse failed with status ${response.status}`);
      return [];
    }

    const payload = await response.json();
    const sectionList =
      payload?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

    if (!Array.isArray(sectionList)) return [];

    const tracks: InnerTubeTrack[] = [];
    const seen = new Set<string>();

    for (const section of sectionList) {
      const carousel = section?.musicCarouselShelfRenderer;
      const title = carousel?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;

      // Extract items from Trending and New music videos shelves
      if (title === "Trending" || title === "New music videos" || title === "New albums & singles") {
        const contents = carousel?.contents;
        if (!Array.isArray(contents)) continue;

        for (const entry of contents) {
          const itemRenderer = entry?.musicResponsiveListItemRenderer;
          if (itemRenderer) {
            const track = parseMusicResponsiveListItem(itemRenderer);
            if (track && !seen.has(track.videoId)) {
              seen.add(track.videoId);
              tracks.push(track);
            }
          }
        }
      }
    }

    return tracks;
  } catch (error) {
    console.error("[InnerTube] Trending error:", error);
    return [];
  }
}

/**
 * Resolves an audio stream directly using YouTube's InnerTube player API.
 * Uses Android VR (1.65.10) client context modeled after Echo Music to bypass bot-gate checks.
 */
export async function resolveInnerTubeAudioStream(
  videoId: string
): Promise<{ url: string; mimeType: string; bitrate?: number } | null> {
  const cleanId = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) return null;

  const clientConfigs = [
    {
      name: "VISIONOS",
      payload: {
        context: {
          client: {
            clientName: "VISIONOS",
            clientVersion: "0.1",
            osName: "visionOS",
            osVersion: "1.3.21O771",
            deviceMake: "Apple",
            deviceModel: "RealityDevice14,1",
            hl: "en",
            gl: "US",
          },
        },
        videoId: cleanId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        "X-YouTube-Client-Name": "101",
        "X-YouTube-Client-Version": "0.1",
      },
    },
    {
      name: "ANDROID_VR",
      payload: {
        context: {
          client: {
            clientName: "ANDROID_VR",
            clientVersion: "1.65.10",
            osName: "Android",
            osVersion: "12L",
            deviceMake: "Oculus",
            deviceModel: "Quest 3",
            androidSdkVersion: "32",
            hl: "en",
            gl: "US",
          },
        },
        videoId: cleanId,
      },
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
        "X-YouTube-Client-Name": "28",
        "X-YouTube-Client-Version": "1.65.10",
      },
    },
  ];

  for (const cfg of clientConfigs) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: cfg.headers,
        body: JSON.stringify(cfg.payload),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (!response.ok) continue;

      const data = (await response.json()) as {
        playabilityStatus?: { status?: string };
        streamingData?: {
          adaptiveFormats?: Array<{ mimeType?: string; url?: string; bitrate?: number }>;
        };
      };

      if (data?.playabilityStatus?.status !== "OK") continue;

      const adaptive = data?.streamingData?.adaptiveFormats;
      if (!Array.isArray(adaptive) || adaptive.length === 0) continue;

      // Filter audio streams that carry direct URLs
      const audioFormats = adaptive.filter(
        (f): f is { mimeType: string; url: string; bitrate?: number } =>
          typeof f.url === "string" && Boolean(f.url) && (f.mimeType?.startsWith("audio/") ?? false)
      );

      if (audioFormats.length === 0) continue;

      // Sort by highest bitrate (prefer best audio fidelity)
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      return {
        url: audioFormats[0].url,
        mimeType: audioFormats[0].mimeType,
        bitrate: audioFormats[0].bitrate,
      };
    } catch {
      // try next client
    }
  }

  return null;
}

