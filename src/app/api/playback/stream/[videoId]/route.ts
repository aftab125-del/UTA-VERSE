import { NextResponse } from "next/server";
import { resolveInnerTubeAudioStream } from "@/lib/music/innertube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");

// In-memory stream cache to avoid re-resolving URLs for chunked range requests (2-hour TTL)
interface CachedStreamData {
  url: string;
  mimeType: string;
  contentLength?: number;
  clientName: string;
  expiresAt: number;
}

const streamCache = new Map<string, CachedStreamData>();
const STREAM_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const urlObj = new URL(request.url);
  const bypassCache = urlObj.searchParams.get("bypass") === "1" || urlObj.searchParams.has("t");

  // Robust video ID sanitation: strip URL-encoding, prefixes, and file extensions
  const cleanId = decodeURIComponent(videoId || "")
    .replace(/^youtube:/, "")
    .replace(/\.(m4a|webm|mp3)$/, "")
    .trim();

  if (!cleanId || !/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    return new NextResponse("Invalid videoId parameter", { status: 400 });
  }

  // If dedicated backend server is available (e.g. production Vercel deployment), redirect directly
  // This bypasses Vercel's 10-second serverless execution limits and YouTube's AWS IP blocking.
  if (NEBULA_MUSIC_SERVER_URL) {
    const redirectUrl = `${NEBULA_MUSIC_SERVER_URL}/audio/${cleanId}${bypassCache ? "?bypass=1" : ""}`;
    return NextResponse.redirect(redirectUrl, 307);
  }

  if (bypassCache) {
    streamCache.delete(cleanId);
  }

  // 1. Get cached stream or resolve fresh
  let streamData = streamCache.get(cleanId);
  const now = Date.now();

  if (!streamData || now > streamData.expiresAt) {
    const resolved = await resolveInnerTubeAudioStream(cleanId);
    if (!resolved?.url) {
      console.error(`[StreamProxy] Failed to resolve InnerTube stream for ${cleanId}`);
      return new NextResponse("Audio stream could not be resolved", { status: 502 });
    }
    streamData = {
      url: resolved.url,
      mimeType: resolved.mimeType,
      contentLength: resolved.contentLength,
      clientName: resolved.clientName,
      expiresAt: now + STREAM_CACHE_TTL_MS,
    };
    streamCache.set(cleanId, streamData);
  }

  // 2. Extract requested Range header
  const rangeHeader = request.headers.get("range");

  // Crucial: Google Video throttles un-ranged requests to ~30 kB/s, but delivers ranged requests
  // (such as bytes=0- or bytes=X-) at full 2.5+ MB/s line rate without any artificial chunk bounding.
  const upstreamRangeHeader = rangeHeader ? rangeHeader : "bytes=0-";

  // 3. Request audio from Google Video CDN
  const fetchHeaders: HeadersInit = {
    "User-Agent":
      streamData.clientName === "VISIONOS"
        ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        : "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    Referer: "https://music.youtube.com/",
    Origin: "https://music.youtube.com",
    Range: upstreamRangeHeader,
  };

  try {
    let upstreamRes = await fetch(streamData.url, {
      headers: fetchHeaders,
      cache: "no-store",
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      // If 403 or stream expired, bust cache and try once more
      if (upstreamRes.status === 403 || upstreamRes.status === 410) {
        streamCache.delete(cleanId);
        const fresh = await resolveInnerTubeAudioStream(cleanId);
        if (fresh?.url) {
          streamData = {
            url: fresh.url,
            mimeType: fresh.mimeType,
            contentLength: fresh.contentLength,
            clientName: fresh.clientName,
            expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
          };
          streamCache.set(cleanId, streamData);
          upstreamRes = await fetch(fresh.url, { headers: fetchHeaders, cache: "no-store" });
        }
      }

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return new NextResponse(`Upstream audio provider returned ${upstreamRes.status}`, {
          status: upstreamRes.status,
        });
      }
    }

    return buildResponse(upstreamRes, rangeHeader, streamData.mimeType, streamData.contentLength);
  } catch (error) {
    console.error("[StreamProxy] Upstream fetch error:", error);
    return new NextResponse("Failed to proxy audio stream", { status: 502 });
  }
}

function buildResponse(
  upstreamRes: Response,
  requestedRange: string | null,
  fallbackMimeType: string,
  fallbackContentLength?: number
): Response {
  const headers = new Headers();
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600, immutable");

  const upstreamContentType = upstreamRes.headers.get("content-type") || fallbackMimeType;
  headers.set("content-type", upstreamContentType);

  if (requestedRange) {
    // Client sent Range header (e.g. bytes=0- or bytes=0-1 or bytes=10000-): Return 206 Partial Content
    const upstreamContentRange = upstreamRes.headers.get("content-range");
    const upstreamContentLength = upstreamRes.headers.get("content-length");
    if (upstreamContentRange) headers.set("content-range", upstreamContentRange);
    if (upstreamContentLength) headers.set("content-length", upstreamContentLength);

    return new Response(upstreamRes.body, {
      status: 206,
      headers,
    });
  } else {
    // Client sent standard GET without Range: Return 200 OK (RFC 9110 compliant)
    const upstreamContentRange = upstreamRes.headers.get("content-range");
    let totalLength = fallbackContentLength;
    if (upstreamContentRange) {
      const match = upstreamContentRange.match(/\/(\d+)$/);
      if (match) totalLength = parseInt(match[1], 10);
    }
    if (totalLength) {
      headers.set("content-length", totalLength.toString());
    }

    return new Response(upstreamRes.body, {
      status: 200,
      headers,
    });
  }
}
