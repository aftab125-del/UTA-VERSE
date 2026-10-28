import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface ExtractedTrack {
  title: string;
  artist: string;
  durationMs: number;
}

interface SpotifyEmbedItem {
  title?: string;
  subtitle?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Extracts the canonical Spotify playlist ID from varied URL formats:
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
 * - https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M
 * - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
 * - Handles spotify.link redirects
 */
async function resolvePlaylistId(input: string): Promise<string> {
  let target = input.trim();

  // Handle spotify.link shorteners by following HTTP redirects
  if (target.includes("spotify.link/")) {
    try {
      const headRes = await fetch(target, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });
      if (headRes.url && headRes.url !== target) {
        target = headRes.url;
      }
    } catch {
      // If HEAD fails, attempt GET with redirect
      try {
        const getRes = await fetch(target, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        if (getRes.url && getRes.url !== target) {
          target = getRes.url;
        }
      } catch (err) {
        console.warn("[SpotifyExtract] Failed to follow shortlink redirect:", err);
      }
    }
  }

  if (target.includes("/playlist/")) {
    const after = target.split("/playlist/")[1] || "";
    return after.split("?")[0].split("/")[0].split("&")[0].trim();
  }

  if (target.startsWith("spotify:playlist:")) {
    return target.replace("spotify:playlist:", "").split("?")[0].trim();
  }

  // Raw alphanumeric Spotify ID (typically 22 characters)
  if (/^[A-Za-z0-9]{15,35}$/.test(target)) {
    return target;
  }

  return "";
}

function cleanHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00A0/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json(
        { error: "A valid Spotify playlist URL or ID is required." },
        { status: 400 }
      );
    }

    const playlistId = await resolvePlaylistId(rawUrl);
    if (!playlistId) {
      return NextResponse.json(
        { error: "Could not find a valid Spotify playlist ID in the provided link." },
        { status: 400 }
      );
    }

    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const response = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "The Spotify playlist was not found. Please ensure it is public." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Spotify embed request returned status ${response.status}.` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const scriptMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);

    if (!scriptMatch || !scriptMatch[1]) {
      return NextResponse.json(
        { error: "Failed to parse Spotify playlist page. Please verify the playlist link is public." },
        { status: 422 }
      );
    }

    const json = JSON.parse(scriptMatch[1]);
    const entity = json?.props?.pageProps?.state?.data?.entity;

    if (!entity) {
      return NextResponse.json(
        { error: "The playlist appears to be private, restricted, or empty." },
        { status: 422 }
      );
    }

    const name = cleanHtmlEntities(entity.name || "Spotify Playlist");
    const description = entity.subtitle ? cleanHtmlEntities(entity.subtitle) : "Imported from Spotify";

    // Extract cover image
    const coverUrl: string | null =
      entity?.visualIdentity?.image?.[0]?.url ||
      entity?.coverArt?.sources?.[0]?.url ||
      null;

    // Extract track list
    const rawTrackList: SpotifyEmbedItem[] = Array.isArray(entity.trackList) ? entity.trackList : [];
    const tracks: ExtractedTrack[] = [];

    for (const item of rawTrackList) {
      const rawTitle = typeof item.title === "string" ? cleanHtmlEntities(item.title) : "";
      const rawArtist = typeof item.subtitle === "string" ? cleanHtmlEntities(item.subtitle) : "";
      const durationMs = typeof item.duration === "number" ? item.duration : 0;

      if (rawTitle) {
        tracks.push({
          title: rawTitle,
          artist: rawArtist,
          durationMs,
        });
      }
    }

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No playable tracks found in this Spotify playlist." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      playlistId,
      name,
      description,
      coverUrl,
      total: tracks.length,
      tracks,
    });
  } catch (error) {
    console.error("[SpotifyExtract] Error extracting playlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract Spotify playlist." },
      { status: 500 }
    );
  }
}
