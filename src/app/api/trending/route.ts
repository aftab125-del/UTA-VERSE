import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getInnerTubeTrending } from "@/lib/music/innertube";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");
const TRENDING_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export const runtime = "nodejs";

const SPAM_REGEX =
  /\b(mix|top\s*\d+|non\s*stop|nonstop|compilation|playlist|full\s*album|full\s*tracklist|mashup|megamix|\d+\s*hours?|best\s*songs|greatest\s*hits|jukebox|audio\s*jukebox|all\s*songs|collection)\b|[~〜]/i;

export async function GET() {
  const supabase = createSupabaseAdminClient();

  // 1. Check Supabase trending_cache first
  try {
    const { data } = await supabase
      .from("trending_cache")
      .select("results, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      const ageMs = Date.now() - new Date(data.fetched_at).getTime();
      if (ageMs < TRENDING_CACHE_TTL_MS) {
        const rawList = data.results as Array<{
          videoId?: string;
          title?: string;
          channelTitle?: string;
          thumbnail?: string;
        }>;
        const filtered = rawList.filter((t) => t && t.title && !SPAM_REGEX.test(t.title));
        if (filtered.length > 0) {
          console.info(`[TrendingAPI] [CACHE HIT] Returning ${filtered.length} trending tracks (age=${Math.round(ageMs / 1000)}s)`);
          return NextResponse.json(filtered);
        }
      }
    }
  } catch (supabaseError) {
    console.warn("[TrendingAPI] Supabase cache read skipped:", supabaseError);
  }

  // 2. Fetch fresh real-time trending tracks from YouTube Music InnerTube
  try {
    console.info("[TrendingAPI] Fetching real-time trending from YouTube Music InnerTube");
    const trending = await getInnerTubeTrending();
    const cleanList = trending
      .filter((t) => t && t.title && !SPAM_REGEX.test(t.title))
      .map((t) => ({
        videoId: t.videoId,
        title: t.title,
        channelTitle: t.channelTitle,
        thumbnail: t.thumbnail,
      }));

    if (cleanList.length > 0) {
      // Asynchronously update Supabase trending_cache
      try {
        void Promise.resolve(
          supabase.from("trending_cache").insert({
            query: "trending",
            results: cleanList,
            fetched_at: new Date().toISOString(),
          })
        ).catch((err) => {
          console.warn("[TrendingAPI] Failed to update trending cache:", err);
        });
      } catch (cacheWriteErr) {
        console.warn("[TrendingAPI] Supabase write error:", cacheWriteErr);
      }

      return NextResponse.json(cleanList);
    }
  } catch (innerTubeError) {
    console.warn("[TrendingAPI] InnerTube trending failed, falling back to upstream/cache:", innerTubeError);
  }

  // 3. Fallback: Try upstream backend server GET /trending if configured
  if (NEBULA_MUSIC_SERVER_URL) {
    try {
      const upstreamUrl = `${NEBULA_MUSIC_SERVER_URL}/trending`;
      const response = await fetch(upstreamUrl, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (Array.isArray(payload) && payload.length > 0) {
          return NextResponse.json(payload);
        }
      }
    } catch (backendError) {
      console.warn("[TrendingAPI] Upstream backend /trending call failed:", backendError);
    }
  }

  // 4. Stale Cache Fallback: Return any available trending cache even if older than TTL
  try {
    const { data } = await supabase
      .from("trending_cache")
      .select("results")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      const rawList = data.results as Array<{
        videoId?: string;
        title?: string;
        channelTitle?: string;
        thumbnail?: string;
      }>;
      const filtered = rawList.filter((t) => t && t.title && !SPAM_REGEX.test(t.title));
      if (filtered.length > 0) {
        return NextResponse.json(filtered);
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.json([], { status: 200 });
}
