import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOfficialStudioTrack, scoreTrackForStudioRanking } from "@/lib/music/lyrics";
import type { Json } from "@/types/database";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runtime = "nodejs";

interface SearchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  isSynced?: boolean;
}

function processSearchResults(items: unknown[]): SearchItem[] {
  const valid: SearchItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const videoId = typeof raw.videoId === "string" ? raw.videoId : "";
    const title = typeof raw.title === "string" ? raw.title : "";
    const channelTitle = typeof raw.channelTitle === "string" ? raw.channelTitle : "";
    const thumbnail = typeof raw.thumbnail === "string" ? raw.thumbnail : "";
    if (videoId && title) {
      valid.push({ videoId, title, channelTitle, thumbnail });
    }
  }

  if (valid.length === 0) return [];

  // Sort so official studio cuts appear first
  valid.sort((a, b) => {
    return scoreTrackForStudioRanking(b) - scoreTrackForStudioRanking(a);
  });

  // Assign `isSynced: true` strictly to the top qualifying studio track
  let assigned = false;
  return valid.map((item, idx) => {
    if (!assigned && (isOfficialStudioTrack(item) || idx === 0)) {
      assigned = true;
      return { ...item, isSynced: true };
    }
    return { ...item, isSynced: false };
  });
}

export async function GET(request: Request) {
  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!rawQuery || rawQuery.length > 200) {
    return NextResponse.json({ error: "A non-empty search query of 200 characters or fewer is required." }, { status: 400 });
  }

  const normalizedQuery = rawQuery.toLowerCase();

  // 1. Check Supabase search_cache first
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("search_cache")
      .select("results, created_at")
      .eq("query", normalizedQuery)
      .maybeSingle();

    if (!error && data) {
      const ageMs = Date.now() - new Date(data.created_at).getTime();
      const hasResults = Array.isArray(data.results) && data.results.length > 0;

      if (ageMs < SEARCH_CACHE_TTL_MS && hasResults) {
        console.info(`[YouTubeSearchProxy] [CACHE HIT] query="${normalizedQuery}" age=${Math.round(ageMs / 1000)}s count=${(data.results as unknown[]).length}`);
        const processed = processSearchResults(data.results as unknown[]);
        return NextResponse.json(processed);
      }
    }
  } catch (cacheErr) {
    console.warn("[YouTubeSearchProxy] Supabase search cache read skipped:", cacheErr instanceof Error ? cacheErr.message : cacheErr);
  }

  // 2. Cache miss: Query upstream backend
  if (!NEBULA_MUSIC_SERVER_URL) {
    console.error("[YouTubeSearchProxy] NEBULA_MUSIC_SERVER_URL is not configured.");
    return NextResponse.json({ error: "YouTube search is not configured." }, { status: 500 });
  }

  try {
    const upstreamUrl = `${NEBULA_MUSIC_SERVER_URL}/search?q=${encodeURIComponent(rawQuery)}`;
    const response = await fetch(upstreamUrl, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "Invalid search response." }));

    console.info("[YouTubeSearchProxy] Backend response", { status: response.status, query: rawQuery });

    if (response.ok && Array.isArray(payload) && payload.length > 0) {
      const processed = processSearchResults(payload);

      // 3. Cache valid results in Supabase asynchronously
      try {
        const supabase = createSupabaseAdminClient();
        void Promise.resolve(
          supabase
            .from("search_cache")
            .upsert(
              {
                query: normalizedQuery,
                results: processed as unknown as Json,
                created_at: new Date().toISOString(),
              },
              { onConflict: "query" }
            )
        )
          .then(() => {
            console.info(`[YouTubeSearchProxy] Cached ${processed.length} ranked search results for "${normalizedQuery}"`);
          })
          .catch((upsertErr) => {
            console.warn("[YouTubeSearchProxy] Failed to write search cache:", upsertErr);
          });
      } catch (upsertErr) {
        console.warn("[YouTubeSearchProxy] Supabase search cache write error:", upsertErr);
      }

      return NextResponse.json(processed);
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[YouTubeSearchProxy] Backend request failed", {
      query: rawQuery,
      message: error instanceof Error ? error.message : "Unknown search error",
    });
    return NextResponse.json({ error: "Unable to reach YouTube search." }, { status: 502 });
  }
}
