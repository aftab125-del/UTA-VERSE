import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

async function checkSupabasePlaybackCache(videoId: string) {
  try {
    const supabase = createSupabaseAdminClient();

    // 1. Check table first (fastest, indexed query)
    const { data: row } = await supabase
      .from("playback_cache")
      .select("audio_url")
      .eq("video_id", videoId)
      .maybeSingle();

    if (row?.audio_url) {
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

async function persistAudioToSupabase(videoId: string, title: string, artist: string, streamUrl: string): Promise<string> {
  try {
    const supabase = createSupabaseAdminClient();

    // If it's already a Supabase public URL, just record in table
    if (streamUrl.includes(`/storage/v1/object/public/${AUDIO_BUCKET}/`)) {
      void supabase.from("playback_cache").upsert({
        video_id: videoId,
        title,
        artist,
        audio_url: streamUrl,
        created_at: new Date().toISOString(),
      }, { onConflict: "video_id" });
      return streamUrl;
    }

    // Download audio stream and upload to audio-cache bucket
    console.info(`[PlaybackResolver] Downloading stream to cache in Supabase: ${videoId}`);
    const audioRes = await fetch(streamUrl);
    if (!audioRes.ok) {
      console.warn(`[PlaybackResolver] Could not download audio stream for caching (HTTP ${audioRes.status})`);
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
    }, { onConflict: "video_id" });

    return permanentUrl;
  } catch (err) {
    console.warn("[PlaybackResolver] Audio cache persistence error:", err instanceof Error ? err.message : err);
    return streamUrl;
  }
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { title?: unknown; artist?: unknown; videoId?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid playback resolver request." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const requestedVideoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
  if (
    !title ||
    !artist ||
    title.length > 200 ||
    artist.length > 200 ||
    (requestedVideoId && !/^[A-Za-z0-9_-]{11}$/.test(requestedVideoId))
  ) {
    return NextResponse.json({ error: "A valid track title and artist are required." }, { status: 400 });
  }

  // 1. Check Supabase Storage / playback_cache for instant CDN playback
  if (requestedVideoId) {
    const cachedUrl = await checkSupabasePlaybackCache(requestedVideoId);
    if (cachedUrl) {
      console.info(`[PlaybackResolver] [CACHE HIT] Direct Supabase CDN playback for ${requestedVideoId}`);
      return NextResponse.json({ status: "ready", sourceUrl: cachedUrl, videoId: requestedVideoId });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!requestedVideoId && !apiKey) {
    console.error("[PlaybackResolver] YOUTUBE_API_KEY is not configured.");
    return NextResponse.json({ error: "Playback source resolution is not configured." }, { status: 500 });
  }

  if (!NEBULA_MUSIC_SERVER_URL) {
    console.error("[PlaybackResolver] NEBULA_MUSIC_SERVER_URL is not configured.");
    return NextResponse.json({ error: "Playback source resolution is not configured." }, { status: 500 });
  }

  try {
    const queries = requestedVideoId ? [] : [`${title} ${artist}`, `${artist} ${title} audio`];
    let candidates: SearchCandidate[] = [];
    let lastFailure: { status: number; reason: string | null; message: string | null } | null = null;

    for (const searchQuery of queries) {
      const requestUrl = `${YOUTUBE_SEARCH_ENDPOINT}?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(searchQuery)}&key=[redacted]`;
      console.info("[PlaybackResolver] YouTube search request", { requestUrl, searchQuery });
      const { response, data } = await searchYouTube(searchQuery, apiKey as string);
      const reason = data.error?.errors?.[0]?.reason ?? data.error?.status ?? null;
      const message = data.error?.message ?? null;
      console.info("[PlaybackResolver] YouTube search response", {
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

    if (lastFailure) {
      console.error("[PlaybackResolver] YouTube upstream failure", { title, artist, ...lastFailure });
      return NextResponse.json({ error: "The playback source search failed." }, { status: 502 });
    }

    const rankedCandidates = requestedVideoId
      ? [{ id: { videoId: requestedVideoId }, snippet: { title, channelTitle: artist } }]
      : [...candidates]
        .filter((candidate) => /^[A-Za-z0-9_-]{11}$/.test(candidate.id?.videoId ?? ""))
        .sort((left, right) => candidateScore(right, title, artist) - candidateScore(left, title, artist));
    if (rankedCandidates.length === 0) {
      console.error("[PlaybackResolver] YouTube returned no video candidates", { title, artist, items: candidates.length });
      return NextResponse.json({ error: "No playable source was found for this track." }, { status: 502 });
    }

    let lastStreamFailureError: string | null = null;
    for (const candidate of rankedCandidates) {
      const videoId = candidate.id?.videoId as string;

      // Check cache for this candidate if not already checked
      if (!requestedVideoId) {
        const cachedUrl = await checkSupabasePlaybackCache(videoId);
        if (cachedUrl) {
          console.info(`[PlaybackResolver] [CACHE HIT] Found candidate in Supabase Storage: ${videoId}`);
          return NextResponse.json({ status: "ready", sourceUrl: cachedUrl, videoId });
        }
      }

      const sourceUrl = `${NEBULA_MUSIC_SERVER_URL}/stream/${videoId}`;
      console.info("[PlaybackResolver] Probing stream candidate", { title, artist, videoId });
      const stream = await probeStreamEndpoint(sourceUrl);
      console.info("[PlaybackResolver] Stream endpoint response", {
        title,
        artist,
        videoId,
        status: stream.status,
      });

      if (stream.status === "ready") {
        console.info("[PlaybackResolver] Source resolved, saving to Supabase Storage", {
          title,
          artist,
          videoId,
        });

        // Persist to Supabase Storage and database
        const cachedSourceUrl = await persistAudioToSupabase(videoId, title, artist, stream.url);

        return NextResponse.json({ status: "ready", sourceUrl: cachedSourceUrl, videoId });
      }

      if (stream.status === "processing") {
        console.info("[PlaybackResolver] Stream processing in background", { title, artist, videoId });
        return NextResponse.json({ status: "processing", videoId }, { status: 202 });
      }

      lastStreamFailureError = stream.error;
      console.error("[PlaybackResolver] Stream candidate returned error", { title, artist, videoId, error: stream.error });
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
