import { NextResponse } from "next/server";
import { searchInnerTubeSongs, resolveInnerTubeAudioStream } from "@/lib/music/innertube";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { spawn } from "child_process";

const NEBULA_MUSIC_SERVER_URL = process.env.NEBULA_MUSIC_SERVER_URL?.replace(/\/+$/, "");
const AUDIO_BUCKET = process.env.AUDIO_CACHE_BUCKET || "audio-cache";

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; description?: string };
  }>;
  error?: { status?: string; message?: string; errors?: Array<{ reason?: string }> };
};

type SearchCandidate = NonNullable<YouTubeSearchResponse["items"]>[number];

const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const STREAM_PROBE_TIMEOUT_MS = 15_000;

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateScore(candidate: SearchCandidate, title: string, artist: string) {
  const candidateText = normalized(
    `${candidate.snippet?.title ?? ""} ${candidate.snippet?.channelTitle ?? ""} ${candidate.snippet?.description ?? ""}`,
  );
  const requestedTitle = normalized(title);
  const requestedArtist = normalized(artist);
  let score = 0;
  if (candidateText.includes(requestedTitle)) score += 3;
  if (candidateText.includes(requestedArtist)) score += 3;
  if (candidateText.includes("official")) score += 1;
  if (candidateText.includes("audio")) score += 1;
  return score;
}

async function searchYouTube(query: string, apiKey: string) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: "5",
    q: query,
    key: apiKey,
  });
  const response = await fetch(`${YOUTUBE_SEARCH_ENDPOINT}?${params.toString()}`, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as YouTubeSearchResponse;
  return { response, data };
}

async function extractDirectStreamUrl(videoId: string): Promise<string | null> {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const nodePath = process.execPath;
  const commonArgs = [
    "-4",
    "--no-warnings",
    "--no-playlist",
    "-g",
    "-f",
    "140/bestaudio[ext=m4a]/bestaudio/best",
    "--extractor-args",
    "youtube:player_client=visionos,tvhtml5,android_vr",
  ];

  if (nodePath) {
    commonArgs.push("--js-runtimes", `node:${nodePath}`);
  }

  const commands = [
    { cmd: "py", args: ["-m", "yt_dlp", ...commonArgs, youtubeUrl] },
    { cmd: "python", args: ["-m", "yt_dlp", ...commonArgs, youtubeUrl] },
    { cmd: "yt-dlp", args: [...commonArgs, youtubeUrl] },
  ];

  for (const { cmd, args } of commands) {
    try {
      const url = await new Promise<string | null>((resolve) => {
        let stdout = "";
        let stderr = "";
        const child = spawn(/*turbopackIgnore: true*/ cmd, args, { windowsHide: true });
        const timer = setTimeout(() => {
          try { child.kill(); } catch {}
          resolve(null);
        }, 12000);

        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", () => {
          clearTimeout(timer);
          resolve(null);
        });
        child.on("close", (code: number | null) => {
          clearTimeout(timer);
          if (code === 0 && stdout.trim().startsWith("http")) {
            const lines = stdout
              .trim()
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.startsWith("http"));
            resolve(lines[0] || null);
          } else {
            resolve(null);
          }
        });
      });

      if (url) {
        return url;
      }
    } catch {
      // try next fallback
    }
  }
  return null;
}

async function fetchEmergencyPipedStream(videoId: string): Promise<string | null> {
  const instances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.ducks.party",
    "https://pipedapi.leptons.xyz",
    "https://api.piped.privacydev.net",
  ];

  for (const base of instances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${base}/streams/${videoId}`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          audioStreams?: Array<{ url?: string; bitrate?: number }>;
        } | null;
        const audioStreams = data?.audioStreams;
        if (Array.isArray(audioStreams) && audioStreams.length > 0) {
          const sorted = audioStreams
            .filter((s) => Boolean(s.url))
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          if (sorted[0]?.url) return sorted[0].url;
        }
      }
    } catch {
      // try next instance
    }
  }
  return null;
}

type StreamProbeResult =
  | { status: "ready"; url: string }
  | { status: "processing" }
  | { status: "error"; error: string };

async function probeStreamEndpoint(sourceUrl: string): Promise<StreamProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, { cache: "no-store", signal: controller.signal });
    const contentType = response.headers.get("content-type") ?? "";

    if (response.status === 202) {
      return { status: "processing" };
    }

    if (response.ok) {
      if (contentType.toLowerCase().includes("application/json")) {
        const payload = (await response.json().catch(() => ({}))) as { status?: string; url?: string; error?: string };
        if (payload.status === "ready" && typeof payload.url === "string" && payload.url) {
          return { status: "ready", url: payload.url };
        }
        if (payload.status === "processing") {
          return { status: "processing" };
        }
      } else {
        const resolvedUrl = response.url || sourceUrl;
        return { status: "ready", url: resolvedUrl };
      }
    }

    let upstreamError = "Stream endpoint returned an error.";
    if (contentType.toLowerCase().includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (typeof payload?.error === "string") upstreamError = payload.error;
    }
    return { status: "error", error: upstreamError };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown stream probe error";
    return { status: "error", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Supabase Storage & Database Cache Helpers ──
async function checkSupabasePlaybackCache(videoId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();

    // 1. Check table first (fastest indexed query)
    const { data: row } = await supabase
      .from("playback_cache")
      .select("audio_url")
      .eq("video_id", videoId)
      .maybeSingle();

    if (row?.audio_url) {
      void supabase
        .from("playback_cache")
        .update({ last_played_at: new Date().toISOString() })
        .eq("video_id", videoId);
      return row.audio_url;
    }

    // 2. Check storage bucket directly
    const fileName = `${videoId}.m4a`;
    const { data: fileList } = await supabase.storage
      .from(AUDIO_BUCKET)
      .list("", { search: fileName, limit: 1 });

    if (Array.isArray(fileList) && fileList.some((f) => f.name === fileName)) {
      const publicUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName).data.publicUrl;
      return publicUrl;
    }
  } catch (cacheErr) {
    console.warn("[PlaybackResolver] Supabase cache check skipped:", cacheErr instanceof Error ? cacheErr.message : cacheErr);
  }

  return null;
}

async function persistAudioToSupabase(
  videoId: string,
  title: string,
  artist: string,
  streamUrl: string
): Promise<string> {
  try {
    const supabase = createSupabaseAdminClient();

    // If it's already a Supabase public URL, just update table
    if (streamUrl.includes(`/storage/v1/object/public/${AUDIO_BUCKET}/`)) {
      void supabase.from("playback_cache").upsert({
        video_id: videoId,
        title,
        artist,
        audio_url: streamUrl,
        created_at: new Date().toISOString(),
        last_played_at: new Date().toISOString(),
      }, { onConflict: "video_id" });
      return streamUrl;
    }

    console.info(`[PlaybackResolver] Downloading stream to cache in Supabase: ${videoId}`);
    const audioRes = await fetch(streamUrl);
    if (!audioRes.ok) {
      console.warn(`[PlaybackResolver] Could not download audio stream for Supabase caching (HTTP ${audioRes.status})`);
      return streamUrl;
    }

    const arrayBuf = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const fileName = `${videoId}.m4a`;

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(fileName, buffer, {
        contentType: "audio/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.warn("[PlaybackResolver] Failed to upload audio to Supabase Storage:", uploadError.message);
      return streamUrl;
    }

    const { data: publicUrlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
    const permanentUrl = publicUrlData?.publicUrl || streamUrl;

    console.info(`[PlaybackResolver] [CACHE SAVED] ${videoId} cached in ${AUDIO_BUCKET} bucket (${buffer.length} bytes)`);

    void supabase.from("playback_cache").upsert({
      video_id: videoId,
      title,
      artist,
      audio_url: permanentUrl,
      file_size: buffer.length,
      created_at: new Date().toISOString(),
      last_played_at: new Date().toISOString(),
    }, { onConflict: "video_id" });

    return permanentUrl;
  } catch (err) {
    console.warn("[PlaybackResolver] Audio cache persistence error:", err instanceof Error ? err.message : err);
    return streamUrl;
  }
}

// ── In-Memory Stream Cache (Echo Music Model: Zero Cloud Storage, Zero Disk) ──
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const STREAM_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getCachedStream(videoId: string): string | null {
  const cached = streamUrlCache.get(videoId);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    streamUrlCache.delete(videoId);
    return null;
  }
  return cached.url;
}

function setCachedStream(videoId: string, url: string): void {
  // Prune if cache gets too large (> 500 entries)
  if (streamUrlCache.size > 500) {
    const now = Date.now();
    for (const [key, value] of streamUrlCache.entries()) {
      if (now > value.expiresAt) streamUrlCache.delete(key);
    }
    if (streamUrlCache.size > 500) {
      const firstKey = streamUrlCache.keys().next().value;
      if (firstKey) streamUrlCache.delete(firstKey);
    }
  }
  streamUrlCache.set(videoId, { url, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    title?: unknown;
    artist?: unknown;
    videoId?: unknown;
    trackId?: unknown;
    id?: unknown;
    bypassCache?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid playback resolver request." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const bypassCache = Boolean(body.bypassCache);

  // Extract videoId robustly from body.videoId, body.trackId, or body.id
  let rawVideoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  if (!rawVideoId) {
    const altId = typeof body.trackId === "string" ? body.trackId.trim() : typeof body.id === "string" ? body.id.trim() : "";
    if (altId.startsWith("youtube:")) {
      rawVideoId = altId.replace(/^youtube:/, "").trim();
    } else if (/^[A-Za-z0-9_-]{11}$/.test(altId)) {
      rawVideoId = altId;
    }
  }

  const requestedVideoId = /^[A-Za-z0-9_-]{11}$/.test(rawVideoId) ? rawVideoId : "";
  const safeTitle = title || "Unknown Track";
  const safeArtist = artist || "Unknown Artist";

  if (!requestedVideoId && (!title || !artist)) {
    return NextResponse.json({ error: "A valid track title and artist are required." }, { status: 400 });
  }

  // 1. Check Supabase Storage cache first (Permanent CDN Cache across all users)
  if (requestedVideoId && !bypassCache) {
    const supabaseCachedUrl = await checkSupabasePlaybackCache(requestedVideoId);
    if (supabaseCachedUrl) {
      console.info(`[PlaybackResolver] [CACHE HIT] Direct stream from Supabase Storage for ${requestedVideoId}`);
      return NextResponse.json({ status: "ready", sourceUrl: supabaseCachedUrl, videoId: requestedVideoId });
    }
  }

  // 2. Check in-memory stream cache for fast repeat playback
  if (requestedVideoId && !bypassCache) {
    const cachedUrl = getCachedStream(requestedVideoId);
    if (cachedUrl) {
      console.info(`[PlaybackResolver] [CACHE HIT] Direct stream from memory for ${requestedVideoId}`);
      return NextResponse.json({ status: "ready", sourceUrl: cachedUrl, videoId: requestedVideoId });
    }
  }

  if (!NEBULA_MUSIC_SERVER_URL) {
    console.error("[PlaybackResolver] NEBULA_MUSIC_SERVER_URL is not configured.");
    return NextResponse.json({ error: "Playback source resolution is not configured." }, { status: 500 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    const queries = requestedVideoId ? [] : [`${safeTitle} ${safeArtist}`, `${safeArtist} ${safeTitle} audio`];
    let candidates: SearchCandidate[] = [];
    let lastFailure: { status: number; reason: string | null; message: string | null } | null = null;

    if (!requestedVideoId) {
      // 1. Primary: Use InnerTube (Zero quota, instant YouTube Music match)
      try {
        const query = `${safeTitle} ${safeArtist}`;
        console.info("[PlaybackResolver] Querying InnerTube candidate resolver", { query });
        const innerTubeSongs = await searchInnerTubeSongs(query);
        if (Array.isArray(innerTubeSongs) && innerTubeSongs.length > 0) {
          candidates = innerTubeSongs.map((item) => ({
            id: { videoId: item.videoId },
            snippet: { title: item.title, channelTitle: item.channelTitle },
          }));
        }
      } catch (innerTubeErr) {
        console.warn("[PlaybackResolver] InnerTube candidate search failed:", innerTubeErr);
      }
    }

    if (!requestedVideoId && candidates.length === 0 && apiKey) {
      for (const searchQuery of queries) {
        const requestUrl = `${YOUTUBE_SEARCH_ENDPOINT}?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(searchQuery)}&key=[redacted]`;
        console.info("[PlaybackResolver] YouTube search request fallback", { requestUrl, searchQuery });
        const { response, data } = await searchYouTube(searchQuery, apiKey);
        const reason = data.error?.errors?.[0]?.reason ?? data.error?.status ?? null;
        const message = data.error?.message ?? null;
        console.info("[PlaybackResolver] YouTube search fallback response", {
          status: response.status,
          searchQuery,
          items: data.items?.length ?? 0,
          reason,
          message,
        });

        if (!response.ok) {
          lastFailure = { status: response.status, reason, message };
          break;
        }

        candidates = data.items ?? [];
        if (candidates.length > 0) break;
      }
    }

    // Fallback: If YouTube Data API failed or has no key, query backend search
    if (!requestedVideoId && (lastFailure || candidates.length === 0)) {
      console.info("[PlaybackResolver] Querying backend search fallback", { title: safeTitle, artist: safeArtist });
      try {
        const query = `${safeTitle} ${safeArtist}`;
        const searchRes = await fetch(`${NEBULA_MUSIC_SERVER_URL}/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (searchRes.ok) {
          const searchData = await searchRes.json().catch(() => null);
          if (Array.isArray(searchData) && searchData.length > 0) {
            candidates = searchData.map((item: { videoId?: string; title?: string; channelTitle?: string }) => ({
              id: { videoId: item.videoId },
              snippet: { title: item.title, channelTitle: item.channelTitle },
            }));
            lastFailure = null;
          }
        }
      } catch (fallbackErr) {
        console.warn("[PlaybackResolver] Backend search fallback error:", fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      }
    }

    if (lastFailure && candidates.length === 0) {
      console.error("[PlaybackResolver] Upstream search failure", { title: safeTitle, artist: safeArtist, ...lastFailure });
      return NextResponse.json({ error: "The playback source search failed." }, { status: 502 });
    }

    const rankedCandidates = requestedVideoId
      ? [{ id: { videoId: requestedVideoId }, snippet: { title: safeTitle, channelTitle: safeArtist } }]
      : [...candidates]
        .filter((candidate) => /^[A-Za-z0-9_-]{11}$/.test(candidate.id?.videoId ?? ""))
        .sort((left, right) => candidateScore(right, safeTitle, safeArtist) - candidateScore(left, safeTitle, safeArtist));

    if (rankedCandidates.length === 0) {
      console.error("[PlaybackResolver] No playable candidates found", { title: safeTitle, artist: safeArtist, items: candidates.length });
      return NextResponse.json({ error: "No playable source was found for this track." }, { status: 502 });
    }

    let lastStreamFailureError: string | null = null;
    for (const candidate of rankedCandidates) {
      const videoId = candidate.id?.videoId as string;

      // Check Supabase Storage cache for candidate
      if (!requestedVideoId && !bypassCache) {
        const supabaseCachedUrl = await checkSupabasePlaybackCache(videoId);
        if (supabaseCachedUrl) {
          console.info(`[PlaybackResolver] [CACHE HIT] Candidate found in Supabase Storage: ${videoId}`);
          return NextResponse.json({ status: "ready", sourceUrl: supabaseCachedUrl, videoId });
        }
      }

      // Check in-memory stream cache for candidate
      if (!requestedVideoId && !bypassCache) {
        const cachedUrl = getCachedStream(videoId);
        if (cachedUrl) {
          console.info(`[PlaybackResolver] [CACHE HIT] Direct stream from memory for candidate: ${videoId}`);
          return NextResponse.json({ status: "ready", sourceUrl: cachedUrl, videoId });
        }
      }

      // 0. Primary: Direct InnerTube player stream resolution
      console.info("[PlaybackResolver] Attempting direct InnerTube stream resolution", { videoId });
      try {
        const itStream = await resolveInnerTubeAudioStream(videoId);
        if (itStream?.url) {
          console.info("[PlaybackResolver] Successfully resolved stream via InnerTube", { videoId });
          const streamTarget = NEBULA_MUSIC_SERVER_URL
            ? `${NEBULA_MUSIC_SERVER_URL}/audio/${videoId}?url=${encodeURIComponent(itStream.url)}`
            : itStream.url;
          setCachedStream(videoId, streamTarget);
          void persistAudioToSupabase(videoId, safeTitle, safeArtist, streamTarget);
          return NextResponse.json({ status: "ready", sourceUrl: streamTarget, videoId });
        }
      } catch (itErr) {
        console.warn("[PlaybackResolver] Direct InnerTube stream extraction failed:", itErr);
      }

      // 1. Try local/direct subprocess stream extraction with android_vr client
      console.info("[PlaybackResolver] Attempting direct stream extraction", { videoId });
      const directStreamUrl = await extractDirectStreamUrl(videoId);
      if (directStreamUrl) {
        console.info("[PlaybackResolver] Successfully resolved direct stream URL", { videoId });
        const streamTarget = NEBULA_MUSIC_SERVER_URL
          ? `${NEBULA_MUSIC_SERVER_URL}/audio/${videoId}?url=${encodeURIComponent(directStreamUrl)}`
          : directStreamUrl;
        setCachedStream(videoId, streamTarget);
        void persistAudioToSupabase(videoId, safeTitle, safeArtist, streamTarget);
        return NextResponse.json({ status: "ready", sourceUrl: streamTarget, videoId });
      }

      const sourceUrl = `${NEBULA_MUSIC_SERVER_URL}/stream/${videoId}`;
      console.info("[PlaybackResolver] Probing stream candidate", { title, artist, videoId, bypassCache });
      const stream = await probeStreamEndpoint(sourceUrl);
      console.info("[PlaybackResolver] Stream endpoint response", {
        title,
        artist,
        videoId,
        status: stream.status,
      });

      if (stream.status === "ready") {
        console.info("[PlaybackResolver] Source resolved via proxied stream", {
          title,
          artist,
          videoId,
        });

        // Deliver audio through the server-side streaming proxy to bypass Google Video client-IP 403 Forbidden blocks
        const proxiedAudioUrl = `${NEBULA_MUSIC_SERVER_URL}/audio/${videoId}`;

        // Cache proxied stream URL in memory for fast repeat playback with 0 cloud storage
        setCachedStream(videoId, proxiedAudioUrl);
        void persistAudioToSupabase(videoId, safeTitle, safeArtist, proxiedAudioUrl);

        return NextResponse.json({ status: "ready", sourceUrl: proxiedAudioUrl, videoId });
      }

      if (stream.status === "processing") {
        console.info("[PlaybackResolver] Stream processing in background", { title, artist, videoId });
        return NextResponse.json({ status: "processing", videoId }, { status: 202 });
      }

      lastStreamFailureError = stream.error;
      console.error("[PlaybackResolver] Stream candidate returned error", { title, artist, videoId, error: stream.error });
    }

    if (rankedCandidates.length > 0) {
      const topVideoId = rankedCandidates[0].id?.videoId as string;
      console.info("[PlaybackResolver] Attempting emergency Piped fallback for", topVideoId);
      const emergencyStreamUrl = await fetchEmergencyPipedStream(topVideoId);
      if (emergencyStreamUrl) {
        console.info("[PlaybackResolver] Resolved via emergency Piped fallback", topVideoId);
        const streamTarget = NEBULA_MUSIC_SERVER_URL
          ? `${NEBULA_MUSIC_SERVER_URL}/audio/${topVideoId}?url=${encodeURIComponent(emergencyStreamUrl)}`
          : emergencyStreamUrl;
        setCachedStream(topVideoId, streamTarget);
        void persistAudioToSupabase(topVideoId, safeTitle, safeArtist, streamTarget);
        return NextResponse.json({ status: "ready", sourceUrl: streamTarget, videoId: topVideoId });
      }
    }

    // Secondary Fallback: If requestedVideoId was unplayable (deleted / dead / region-blocked),
    // search YouTube Music by metadata (title + artist) to find an active alternative
    if (requestedVideoId && (safeTitle !== "Unknown Track" || safeArtist !== "Unknown Artist")) {
      console.warn("[PlaybackResolver] requestedVideoId failed to resolve. Searching alternative candidate by metadata...", {
        requestedVideoId,
        safeTitle,
        safeArtist,
      });

      try {
        const query = `${safeTitle} ${safeArtist}`;
        const altSongs = await searchInnerTubeSongs(query);
        const altCandidates = (altSongs || [])
          .filter((s) => s.videoId && s.videoId !== requestedVideoId)
          .map((s) => ({
            id: { videoId: s.videoId },
            snippet: { title: s.title, channelTitle: s.channelTitle },
          }))
          .sort((a, b) => candidateScore(b, safeTitle, safeArtist) - candidateScore(a, safeTitle, safeArtist));

        for (const alt of altCandidates.slice(0, 3)) {
          const altId = alt.id.videoId;
          if (!altId) continue;

          console.info("[PlaybackResolver] Testing alternative metadata candidate", { altId, title: alt.snippet.title });

          // Check Supabase Storage cache first for alt candidate
          const altCached = await checkSupabasePlaybackCache(altId);
          if (altCached) {
            console.info(`[PlaybackResolver] [CACHE HIT] Alternative candidate found in Supabase Storage: ${altId}`);
            return NextResponse.json({ status: "ready", sourceUrl: altCached, videoId: altId });
          }

          // 1. Try InnerTube stream resolution for alt candidate
          try {
            const altStream = await resolveInnerTubeAudioStream(altId);
            if (altStream?.url) {
              const streamTarget = NEBULA_MUSIC_SERVER_URL
                ? `${NEBULA_MUSIC_SERVER_URL}/audio/${altId}?url=${encodeURIComponent(altStream.url)}`
                : altStream.url;
              setCachedStream(altId, streamTarget);
              void persistAudioToSupabase(altId, safeTitle, safeArtist, streamTarget);
              return NextResponse.json({ status: "ready", sourceUrl: streamTarget, videoId: altId });
            }
          } catch {}

          // 2. Try Northflank proxy stream probe
          const altSourceUrl = `${NEBULA_MUSIC_SERVER_URL}/stream/${altId}`;
          const altProbe = await probeStreamEndpoint(altSourceUrl);
          if (altProbe.status === "ready") {
            const proxiedUrl = `${NEBULA_MUSIC_SERVER_URL}/audio/${altId}`;
            setCachedStream(altId, proxiedUrl);
            void persistAudioToSupabase(altId, safeTitle, safeArtist, proxiedUrl);
            return NextResponse.json({ status: "ready", sourceUrl: proxiedUrl, videoId: altId });
          }
        }
      } catch (altErr) {
        console.warn("[PlaybackResolver] Metadata fallback search failed:", altErr);
      }
    }

    console.error("[PlaybackResolver] All stream candidates failed", { title, artist, candidates: rankedCandidates.length, lastStreamFailureError });
    return NextResponse.json({ error: lastStreamFailureError || "The resolved playback stream is unavailable." }, { status: 502 });
  } catch (error) {
    const resolverError = error instanceof Error ? error : new Error("Unknown resolver error");
    const cause = resolverError.cause;
    console.error("[PlaybackResolver] Resolution request failed", {
      title,
      artist,
      stage: "youtube-search-or-stream-probe",
      name: resolverError.name,
      message: resolverError.message,
      causeCode: cause && typeof cause === "object" && "code" in cause ? String(cause.code) : null,
      causeMessage: cause && typeof cause === "object" && "message" in cause ? String(cause.message) : null,
    });
    return NextResponse.json({ error: "The playback source could not be resolved." }, { status: 502 });
  }
}
