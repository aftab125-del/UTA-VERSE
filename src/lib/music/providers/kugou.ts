import { parseLrc, type SyncedLine } from "@/lib/music/lyrics";

interface KugouCandidate {
  id: string;
  accesskey: string;
  duration?: number;
  singer?: string;
  song?: string;
  score?: number;
}

interface KugouSearchResponse {
  status: number;
  candidates?: KugouCandidate[];
}

interface KugouDownloadResponse {
  status: number;
  fmt?: string;
  content?: string;
}

interface KugouMobileSearchItem {
  hash?: string;
  "320hash"?: string;
  filename?: string;
  duration?: number;
}

interface KugouMobileSearchResponse {
  data?: {
    info?: KugouMobileSearchItem[];
  };
}

export interface KugouLyricsResult {
  syncedLyrics: SyncedLine[] | null;
  plainLyrics: string | null;
  rawSyncedLyrics: string | null;
}

/**
 * Searches and downloads synchronized lyrics from Kugou Music (酷狗音乐).
 */
export async function fetchKugouLyrics(
  title: string,
  artist?: string,
  duration?: number
): Promise<KugouLyricsResult | null> {
  if (!title) return null;

  const cleanTitle = title.trim();
  const cleanArtist = (artist || "").trim();
  const query = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;
  const durationMs = duration && duration > 0 ? Math.round(duration * 1000) : "";

  let candidates: KugouCandidate[] = [];

  // Step 1: Direct KRC candidate search
  try {
    const searchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=${encodeURIComponent(
      query
    )}&duration=${durationMs}&hash=`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (searchRes.ok) {
      const data = (await searchRes.json()) as KugouSearchResponse;
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        candidates = data.candidates;
      }
    }
  } catch {
    // Continue to fallback
  }

  // Step 2: Song hash fallback search if direct candidate search had no results
  if (candidates.length === 0) {
    try {
      const mobileSearchUrl = `http://mobileservice.kugou.com/api/v3/lyric/search?version=9108&highlight=1&keyword=${encodeURIComponent(
        query
      )}&plat=0&pagesize=5&area_code=1&page=1&with_res_tag=1`;

      const mobileRes = await fetch(mobileSearchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (mobileRes.ok) {
        let text = await mobileRes.text();
        // Remove JSONP / comment wrappers if present (e.g. <!--KG_TAG_RES_START-->)
        text = text.replace(/<!--KG_TAG_RES_START-->|<!--KG_TAG_RES_END-->/g, "").trim();
        const mobileData = JSON.parse(text) as KugouMobileSearchResponse;

        const info = mobileData.data?.info;
        if (Array.isArray(info) && info.length > 0) {
          const songHash = info[0].hash || info[0]["320hash"];
          if (songHash) {
            const hashSearchUrl = `http://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=&hash=${songHash}`;
            const hashRes = await fetch(hashSearchUrl, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(3000),
            });
            if (hashRes.ok) {
              const hashData = (await hashRes.json()) as KugouSearchResponse;
              if (Array.isArray(hashData.candidates) && hashData.candidates.length > 0) {
                candidates = hashData.candidates;
              }
            }
          }
        }
      }
    } catch {
      // End of search attempts
    }
  }

  if (candidates.length === 0) return null;

  // Step 3: Pick best candidate
  let bestCandidate = candidates[0];
  if (duration && duration > 0) {
    let closestDiff = Infinity;
    for (const c of candidates) {
      if (c.duration && c.duration > 0) {
        const diff = Math.abs(c.duration / 1000 - duration);
        if (diff < closestDiff) {
          closestDiff = diff;
          bestCandidate = c;
        }
      }
    }
  }

  // Step 4: Download the lyrics in LRC format
  try {
    const downloadUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${bestCandidate.id}&accesskey=${bestCandidate.accesskey}&fmt=lrc&charset=utf8`;

    const downloadRes = await fetch(downloadUrl, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!downloadRes.ok) return null;

    const downloadData = (await downloadRes.json()) as KugouDownloadResponse;
    if (!downloadData.content) return null;

    // Decode Base64 UTF-8 string
    const lrcRaw = Buffer.from(downloadData.content, "base64").toString("utf-8");
    if (!lrcRaw || lrcRaw.trim().length === 0) return null;

    const synced = parseLrc(lrcRaw);
    const plain = lrcRaw
      .replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "")
      .replace(/\[[a-z]+:[^\]]*\]/gi, "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join("\n");

    return {
      syncedLyrics: synced && synced.length > 0 ? synced : null,
      plainLyrics: plain.length > 0 ? plain : null,
      rawSyncedLyrics: lrcRaw,
    };
  } catch {
    return null;
  }
}
