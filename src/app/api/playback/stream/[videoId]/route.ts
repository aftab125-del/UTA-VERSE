import { NextResponse } from "next/server";
import { resolveInnerTubeAudioStream } from "@/lib/music/innertube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Echo-Music's Bounded Range Chunk size (2 MB)
const CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const cleanId = videoId?.replace(/\.(m4a|webm|mp3)$/, "").trim();

  if (!cleanId || !/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    return new NextResponse("Invalid videoId parameter", { status: 400 });
  }

  // 1. Get cached stream or resolve fresh
  let streamData = streamCache.get(cleanId);
  const now = Date.now();

  if (!streamData || now > streamData.expiresAt) {
    const resolved = await resolveInnerTubeAudioStream(cleanId);
    if (!resolved?.url) {
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
  const contentLength = streamData.contentLength;

  let upstreamRangeHeader: string | undefined;
  let isPartial = false;

  if (rangeHeader) {
    isPartial = true;
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      let end = match[2] ? parseInt(match[2], 10) : undefined;

      // Crucial Range Chunking from Echo-Music:
      // If end is not specified, bound the request to 2MB ahead of start.
      // Unbounded requests are throttled to 15 kB/s by Google Video CDN;
      // bounded range requests arrive at 5.7 MB/s line rate!
      if (end === undefined) {
        const potentialEnd = start + CHUNK_SIZE_BYTES - 1;
        end = contentLength ? Math.min(potentialEnd, contentLength - 1) : potentialEnd;
      }

      upstreamRangeHeader = `bytes=${start}-${end}`;
    } else {
      upstreamRangeHeader = rangeHeader;
    }
  } else {
    // If browser didn't supply Range, send first chunk to start fast
    if (contentLength) {
      const end = Math.min(CHUNK_SIZE_BYTES - 1, contentLength - 1);
      upstreamRangeHeader = `bytes=0-${end}`;
      isPartial = true;
    }
  }

  // 3. Request audio chunk from Google Video CDN
  const fetchHeaders: HeadersInit = {
    "User-Agent":
      streamData.clientName === "VISIONOS"
        ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        : "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    Referer: "https://music.youtube.com/",
    Origin: "https://music.youtube.com",
    ...(upstreamRangeHeader ? { Range: upstreamRangeHeader } : {}),
  };

  try {
    const upstreamRes = await fetch(streamData.url, {
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
          const retryRes = await fetch(fresh.url, { headers: fetchHeaders, cache: "no-store" });
          if (retryRes.ok || retryRes.status === 206) {
            return buildResponse(retryRes, isPartial);
          }
        }
      }
      return new NextResponse(`Upstream audio provider returned ${upstreamRes.status}`, {
        status: upstreamRes.status,
      });
    }

    return buildResponse(upstreamRes, isPartial);
  } catch (error) {
    console.error("[StreamProxy] Upstream fetch error:", error);
    return new NextResponse("Failed to proxy audio stream", { status: 502 });
  }
}

function buildResponse(upstreamRes: Response, isPartial: boolean): Response {
  const status = upstreamRes.status === 206 || isPartial ? 206 : 200;
  const headers = new Headers();

  const copyHeader = (name: string) => {
    const val = upstreamRes.headers.get(name);
    if (val) headers.set(name, val);
  };

  copyHeader("content-type");
  copyHeader("content-length");
  copyHeader("content-range");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600, immutable");

  return new Response(upstreamRes.body, {
    status,
    headers,
  });
}
