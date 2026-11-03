import { NextResponse } from "next/server";
import { resolveInnerTubeAudioStream, invalidateInnerTubeAudioStream } from "@/lib/music/innertube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");

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

  if (bypassCache) {
    invalidateInnerTubeAudioStream(cleanId);
  }

  // 1. Get cached stream or resolve fresh via native InnerTube engine (Zero Northflank / Echo Music Architecture)
  let resolved = await resolveInnerTubeAudioStream(cleanId, bypassCache);
  if (!resolved?.url) {
    // Fallback to dedicated server if configured and native InnerTube resolution fails
    if (NEBULA_MUSIC_SERVER_URL) {
      console.warn(`[StreamProxy] Native InnerTube resolution failed for ${cleanId}, falling back to dedicated backend`);
      const redirectUrl = `${NEBULA_MUSIC_SERVER_URL}/audio/${cleanId}${bypassCache ? "?bypass=1" : ""}`;
      return NextResponse.redirect(redirectUrl, 307);
    }
    console.error(`[StreamProxy] Failed to resolve InnerTube stream for ${cleanId}`);
    return new NextResponse("Audio stream could not be resolved", { status: 502 });
  }

  // 2. Extract requested Range header
  const rangeHeader = request.headers.get("range");

  // Crucial: Google Video throttles un-ranged requests to ~30 kB/s, but delivers ranged requests
  // (such as bytes=0- or bytes=X-) at full 2.5+ MB/s line rate without any artificial chunk bounding.
  const upstreamRangeHeader = rangeHeader ? rangeHeader : "bytes=0-";

  // 3. Request audio from Google Video CDN with matching client persona
  const fetchHeaders: HeadersInit = {
    "User-Agent":
      resolved.clientName === "VISIONOS"
        ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        : resolved.clientName === "IOS"
        ? "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1 like Mac OS X; en_US)"
        : resolved.clientName === "ANDROID_VR_OCULUS"
        ? "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://music.youtube.com/",
    Origin: "https://music.youtube.com",
    Range: upstreamRangeHeader,
  };

  try {
    let upstreamRes = await fetch(resolved.url, {
      headers: fetchHeaders,
      cache: "no-store",
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      // If 403 or stream expired, bust cache and try once more
      if (upstreamRes.status === 403 || upstreamRes.status === 410) {
        invalidateInnerTubeAudioStream(cleanId);
        const fresh = await resolveInnerTubeAudioStream(cleanId, true);
        if (fresh?.url) {
          resolved = fresh;
          upstreamRes = await fetch(fresh.url, { headers: fetchHeaders, cache: "no-store" });
        }
      }

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return new NextResponse(`Upstream audio provider returned ${upstreamRes.status}`, {
          status: upstreamRes.status,
        });
      }
    }

    return buildResponse(upstreamRes, rangeHeader, resolved.mimeType, resolved.contentLength);
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
