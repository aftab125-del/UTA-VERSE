import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");

export const runtime = "nodejs";

const SPAM_REGEX = /\b(mix|top\s*\d+|non\s*stop|nonstop|compilation|playlist|full\s*album|full\s*tracklist|mashup|megamix|\d+\s*hours?|best\s*songs|greatest\s*hits|jukebox|audio\s*jukebox|all\s*songs|collection)\b|[~〜]/i;

export async function GET() {
  // 1. Try backend server GET /trending
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
      console.warn("[TrendingProxy] Backend /trending call failed, attempting fallback:", backendError);
    }
  }

  // 2. Fallback: Query Supabase trending_cache directly
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("trending_cache")
      .select("results")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
      const rawList = data.results as Array<{ videoId?: string; title?: string; channelTitle?: string; thumbnail?: string }>;
      const filtered = rawList.filter((t) => t && t.title && !SPAM_REGEX.test(t.title));
      if (filtered.length > 0) {
        return NextResponse.json(filtered);
      }
    }
  } catch (supabaseError) {
    console.warn("[TrendingProxy] Supabase cache read failed:", supabaseError);
  }

  // 3. Fallback: Use backend /search to fetch popular singles
  if (NEBULA_MUSIC_SERVER_URL) {
    try {
      const searchQueries = [
        "The Weeknd official music video",
        "Billie Eilish official music video",
        "Dua Lipa official music video",
        "Taylor Swift official music video",
      ];
      const results = await Promise.allSettled(
        searchQueries.map(async (q) => {
          const res = await fetch(`${NEBULA_MUSIC_SERVER_URL}/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
          return res.ok ? res.json() : [];
        })
      );
      const combined: Array<{ videoId: string; title: string; channelTitle: string; thumbnail: string }> = [];
      const seen = new Set<string>();

      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          for (const item of r.value) {
            if (item.videoId && item.title && !seen.has(item.videoId) && !SPAM_REGEX.test(item.title)) {
              seen.add(item.videoId);
              combined.push(item);
            }
          }
        }
      }

      if (combined.length > 0) {
        return NextResponse.json(combined.slice(0, 30));
      }
    } catch (searchError) {
      console.error("[TrendingProxy] Search fallback failed:", searchError);
    }
  }

  return NextResponse.json([], { status: 200 });
}

