import type { SyncedLine } from "@/lib/music/lyrics";

interface YouLyWord {
  time: number; // in milliseconds
  duration?: number; // in milliseconds
  text: string;
  isLineEnding?: number; // 0 for mid-line, 1 for line ending
}

interface YouLyResponse {
  lines?: Array<{
    time?: number;
    text?: string;
  }>;
  lyrics?: string;
  error?: {
    message?: string;
  };
}

const MIRRORS = [
  "https://lyricsplus.prjktla.my.id",
  "https://lyricsplus.atomix.one",
];

export interface YouLyLyricsResult {
  syncedLyrics: SyncedLine[] | null;
  plainLyrics: string | null;
  rawSyncedLyrics: string | null;
}

/**
 * Fetches lyrics from YouLy+ (LyricsPlus API), which aggregates synchronized lyrics
 * from Apple Music, Musixmatch, Spotify, and QQ Music.
 */
export async function fetchYouLyPlusLyrics(
  title: string,
  artist?: string,
  duration?: number
): Promise<YouLyLyricsResult | null> {
  if (!title) return null;

  const cleanTitle = title.trim();
  const cleanArtist = (artist || "").trim();

  for (const base of MIRRORS) {
    try {
      const params = new URLSearchParams({
        title: cleanTitle,
      });

      if (cleanArtist) {
        params.set("artist", cleanArtist);
      }

      if (duration && duration > 0) {
        params.set("duration", duration.toFixed(1));
      }

      const url = `${base}/v1/lyrics/get?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "UTA-VERSE/1.0 (https://github.com/aftab125-del/UTA-VERSE)",
          "X-Client-Package": "UTA-VERSE <https://github.com/aftab125-del/UTA-VERSE>",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) continue;

      const raw = await res.json();

      // Case 1: Word-by-word / Syllable array format (standard YouLy+ output)
      if (Array.isArray(raw) && raw.length > 0) {
        const words = raw as YouLyWord[];
        const syncedLines: SyncedLine[] = [];
        let currentLineWords: string[] = [];
        let currentLineStartTime: number | null = null;

        for (const item of words) {
          if (typeof item.time !== "number") continue;

          if (currentLineStartTime === null) {
            currentLineStartTime = item.time / 1000;
          }

          currentLineWords.push(item.text || "");

          if (item.isLineEnding === 1) {
            const lineText = currentLineWords.join("").trim();
            if (lineText) {
              syncedLines.push({
                time: Math.max(0, currentLineStartTime),
                text: lineText,
              });
            }
            currentLineWords = [];
            currentLineStartTime = null;
          }
        }

        // Flush any remaining words
        if (currentLineWords.length > 0 && currentLineStartTime !== null) {
          const lineText = currentLineWords.join("").trim();
          if (lineText) {
            syncedLines.push({
              time: Math.max(0, currentLineStartTime),
              text: lineText,
            });
          }
        }

        if (syncedLines.length > 0) {
          const plainLyrics = syncedLines.map((l) => l.text).join("\n");
          return {
            syncedLyrics: syncedLines,
            plainLyrics,
            rawSyncedLyrics: null,
          };
        }
      }

      // Case 2: Object format with lines or plain lyrics
      const obj = raw as YouLyResponse;
      if (Array.isArray(obj.lines) && obj.lines.length > 0) {
        const syncedLines: SyncedLine[] = obj.lines
          .filter((l) => typeof l.time === "number" && typeof l.text === "string")
          .map((l) => ({
            time: Math.max(0, l.time! / (l.time! > 1000 ? 1000 : 1)),
            text: (l.text || "").trim(),
          }))
          .filter((l) => l.text.length > 0);

        if (syncedLines.length > 0) {
          return {
            syncedLyrics: syncedLines,
            plainLyrics: syncedLines.map((l) => l.text).join("\n"),
            rawSyncedLyrics: null,
          };
        }
      }

      if (typeof obj.lyrics === "string" && obj.lyrics.trim().length > 0) {
        return {
          syncedLyrics: null,
          plainLyrics: obj.lyrics.trim(),
          rawSyncedLyrics: null,
        };
      }
    } catch {
      // Continue to next mirror
    }
  }

  return null;
}
