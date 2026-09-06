import { NextResponse } from "next/server";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");

export const runtime = "nodejs";

export async function GET() {
  if (!NEBULA_MUSIC_SERVER_URL) {
    console.error("[TrendingProxy] NEBULA_MUSIC_SERVER_URL is not configured.");
    return NextResponse.json({ error: "Music server is not configured." }, { status: 500 });
  }

  try {
    const upstreamUrl = `${NEBULA_MUSIC_SERVER_URL}/trending`;
    const response = await fetch(upstreamUrl, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ error: "Invalid trending response." }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[TrendingProxy] Backend request failed", {
      message: error instanceof Error ? error.message : "Unknown trending error",
    });
    return NextResponse.json({ error: "Unable to reach trending service." }, { status: 502 });
  }
}
