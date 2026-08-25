import { NextResponse } from "next/server";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 200) {
    return NextResponse.json({ error: "A non-empty search query of 200 characters or fewer is required." }, { status: 400 });
  }

  if (!NEBULA_MUSIC_SERVER_URL) {
    console.error("[YouTubeSearchProxy] NEBULA_MUSIC_SERVER_URL is not configured.");
    return NextResponse.json({ error: "YouTube search is not configured." }, { status: 500 });
  }

  try {
    const upstreamUrl = `${NEBULA_MUSIC_SERVER_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(upstreamUrl, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "Invalid search response." }));
    console.info("[YouTubeSearchProxy] Backend response", { status: response.status, query });
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[YouTubeSearchProxy] Backend request failed", {
      query,
      message: error instanceof Error ? error.message : "Unknown search error",
    });
    return NextResponse.json({ error: "Unable to reach YouTube search." }, { status: 502 });
  }
}
