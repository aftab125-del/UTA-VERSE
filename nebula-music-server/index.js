const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
// Each of the three fallback clients shares this timeout; keep it low enough
// to stay within upstream Vercel/Northflank request timeout limits.
const YTDLP_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS) || 25000;
const DIAGNOSTIC_TEXT_LIMIT = 24000;

// -----------------------------------------------------------------------------
// Process safety
// -----------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  console.error('[Server Safety Net] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server Safety Net] Uncaught exception:', error);
});

// -----------------------------------------------------------------------------
// Supabase
// -----------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('[Server] Supabase Storage client initialized.');
} else {
  console.warn(
    '[Server] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.'
  );
}

// -----------------------------------------------------------------------------
// Cookies configuration
// -----------------------------------------------------------------------------

const COOKIES_PATH = '/secrets/cookies.txt';
const hasCookiesFile = fs.existsSync(COOKIES_PATH);

if (hasCookiesFile) {
  console.log(`[Server] YouTube cookies file detected at ${COOKIES_PATH}. Enabling --cookies for yt-dlp.`);
} else {
  console.log(`[Server] No YouTube cookies file found at ${COOKIES_PATH}. Running yt-dlp without --cookies.`);
}

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    status: 'NebulaMusic Server is running',
    ytDlp: true,
    cookies: hasCookiesFile,
    storage: Boolean(supabase),
  });
});

// -----------------------------------------------------------------------------
// Supabase Storage helpers
// -----------------------------------------------------------------------------

async function getSupabaseAudioUrl(videoId) {
  if (!supabase) {
    return null;
  }

  const fileName = `${videoId}.m4a`;

  try {
    const { data, error } = await supabase.storage
      .from('audio-cache')
      .list('', {
        search: fileName,
        limit: 10,
      });

    if (error) {
      console.warn(
        `[Supabase Storage] List error for ${fileName}:`,
        error.message
      );

      return null;
    }

    const exists =
      Array.isArray(data) &&
      data.some((file) => file.name === fileName);

    if (!exists) {
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('audio-cache')
      .getPublicUrl(fileName);

    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.warn(
      `[Supabase Storage] Check failed for ${videoId}:`,
      error.message
    );

    return null;
  }
}

async function uploadToSupabaseStorage(videoId, localFilePath) {
  if (!supabase) {
    return null;
  }

  const fileName = `${videoId}.m4a`;

  console.log(
    `[Supabase Storage] Uploading ${fileName}...`
  );

  const fileBuffer = fs.readFileSync(localFilePath);

  const { error } = await supabase.storage
    .from('audio-cache')
    .upload(fileName, fileBuffer, {
      contentType: 'audio/mp4',
      upsert: true,
    });

  if (error) {
    console.error(
      `[Supabase Storage] Upload failed:`,
      error.message
    );

    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('audio-cache')
    .getPublicUrl(fileName);

  return publicUrlData?.publicUrl || null;
}

// -----------------------------------------------------------------------------
// yt-dlp
// -----------------------------------------------------------------------------

const inFlightDownloads = new Map();

function sanitizeDiagnosticText(value) {
  return String(value || '')
    .replace(/https?:\/\/[^\s]+/gi, (rawUrl) => {
      try {
        const url = new URL(rawUrl);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[redacted-url]';
      }
    })
    .replace(/(authorization|cookie|set-cookie)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]')
    .replace(/(--cookies\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/([?&](?:key|api_key|sig|signature|token|oauth_token)=)[^&\s]+/gi, '$1[redacted]')
    .slice(-DIAGNOSTIC_TEXT_LIMIT);
}

function runCommand(command, args, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        env: process.env,
      });
    } catch (error) {
      resolve({
        available: false,
        version: null,
        error: error.message,
        timedOut: false,
      });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 2000).unref();
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ available: false, version: null, error: error.message, timedOut });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        available: code === 0,
        version: sanitizeDiagnosticText(stdout.trim() || stderr.trim()) || null,
        error: code === 0 ? null : sanitizeDiagnosticText(stderr.trim()) || `exit code ${code}`,
        timedOut,
      });
    });
  });
}

async function getRuntimeDiagnostics() {
  const [python, ytDlp, ffmpeg, deno] = await Promise.all([
    runCommand('python3', ['--version']),
    runCommand('yt-dlp', ['--version']),
    runCommand('ffmpeg', ['-version']),
    runCommand('deno', ['--version']),
  ]);

  return {
    node: process.version,
    python,
    ytDlp,
    ffmpeg: {
      ...ffmpeg,
      version: ffmpeg.version?.split('\n')[0] || null,
      error: ffmpeg.error?.split('\n')[0] || null,
    },
    deno,
    supabaseConfigured: Boolean(supabase),
    cookiesConfigured: hasCookiesFile,
  };
}

function logRuntimeDiagnostics() {
  getRuntimeDiagnostics()
    .then((diagnostics) => {
      console.log('[Runtime Diagnostics]', diagnostics);
    })
    .catch((error) => {
      console.error('[Runtime Diagnostics] Failed:', error.message);
    });
}

function processAndCacheAudio(videoId) {
  if (inFlightDownloads.has(videoId)) {
    console.log(
      `[Cache] Joining existing download: ${videoId}`
    );

    return inFlightDownloads.get(videoId);
  }

  const tempPath = path.join(
    '/tmp',
    `${videoId}.m4a`
  );

  const youtubeUrl =
    `https://www.youtube.com/watch?v=${videoId}`;

  const promise = new Promise((resolve, reject) => {
    let settled = false;
    console.log(
      `[yt-dlp] Starting extraction: ${videoId}`
    );

    cleanup();

    const playerClients = ['android', 'ios', 'web'];

    const runExtraction = (playerClient) => new Promise((resolveAttempt, rejectAttempt) => {
      const args = [
        '--no-playlist',
        '-f',
        'bestaudio[ext=m4a]/bestaudio/best',
        '--extract-audio',
        '--audio-format',
        'm4a',
        '--js-runtimes',
        'deno',
        '--remote-components',
        'ejs:github',
        '--extractor-args',
        `youtube:player_client=${playerClient}`,
        ...(hasCookiesFile ? ['--cookies', COOKIES_PATH] : []),
        '-o',
        tempPath,
        youtubeUrl,
      ];
      const command = `yt-dlp ${args.map((arg) => JSON.stringify(arg)).join(' ')}`;
      const ytdlp = spawn('yt-dlp', args, { env: process.env });
      let stderr = '';
      let stdout = '';
      let attemptTimedOut = false;
      let attemptSettled = false;
      const attemptStartedAt = Date.now();

      const finishFailure = (error, code = null) => {
        if (attemptSettled) return;
        attemptSettled = true;
        clearTimeout(timeout);
        cleanup();
        console.error('[yt-dlp diagnostic]', {
          videoId,
          playerClient,
          command,
          exitCode: code,
          signal: attemptTimedOut ? 'SIGTERM/SIGKILL' : null,
          timedOut: attemptTimedOut,
          elapsedMs: Date.now() - attemptStartedAt,
          outputExists: false,
          outputBytes: 0,
          stderr: sanitizeDiagnosticText(stderr),
          stdout: sanitizeDiagnosticText(stdout),
          spawnError: error?.message || null,
        });
        rejectAttempt(error || new Error(`yt-dlp exited with code ${code}`));
      };

      const timeout = setTimeout(() => {
        attemptTimedOut = true;
        console.error(`[yt-dlp] Timeout after ${YTDLP_TIMEOUT_MS}ms: ${videoId} (${playerClient})`);
        ytdlp.kill('SIGTERM');
        setTimeout(() => {
          if (!attemptSettled) ytdlp.kill('SIGKILL');
        }, 2000).unref();
      }, YTDLP_TIMEOUT_MS);

      ytdlp.stdout.on('data', (data) => { stdout += data.toString(); });
      ytdlp.stderr.on('data', (data) => { stderr += data.toString(); });
      ytdlp.on('error', (error) => finishFailure(error));
      ytdlp.on('close', async (code) => {
        if (attemptSettled) return;
        const outputExists = fs.existsSync(tempPath);
        const outputBytes = outputExists ? fs.statSync(tempPath).size : 0;
        console.error('[yt-dlp diagnostic]', {
          videoId,
          playerClient,
          command,
          exitCode: code,
          signal: attemptTimedOut ? 'SIGTERM/SIGKILL' : null,
          timedOut: attemptTimedOut,
          elapsedMs: Date.now() - attemptStartedAt,
          outputExists,
          outputBytes,
          stderr: sanitizeDiagnosticText(stderr),
          stdout: sanitizeDiagnosticText(stdout),
        });

        if (code !== 0 || !outputExists || outputBytes === 0) {
          clearTimeout(timeout);
          cleanup();
          attemptSettled = true;
          rejectAttempt(new Error(`yt-dlp exited with code ${code}${attemptTimedOut ? ' after timeout' : ''}`));
          return;
        }

        clearTimeout(timeout);
        attemptSettled = true;
        resolveAttempt();
      });
    });

    const extractWithFallback = async () => {
      let lastError;
      for (const playerClient of playerClients) {
        try {
          await runExtraction(playerClient);
          return;
        } catch (error) {
          lastError = error;
          console.warn(`[yt-dlp] ${playerClient} client failed for ${videoId}; trying fallback client.`);
        }
      }
      throw lastError || new Error('yt-dlp extraction failed for all configured clients.');
    };

    extractWithFallback().then(async () => {
      if (settled) return;
      settled = true;

      try {
        const stats = fs.statSync(tempPath);

        if (stats.size === 0) {
          cleanup();

          reject(
            new Error(
              'yt-dlp produced an empty audio file.'
            )
          );

          return;
        }

        console.log(
          `[yt-dlp] Download complete: ${videoId} (${stats.size} bytes)`
        );

        if (!supabase) {
          cleanup();

          reject(
            new Error(
              'Supabase Storage is not configured.'
            )
          );

          return;
        }

        const uploadedUrl =
          await uploadToSupabaseStorage(
            videoId,
            tempPath
          );

        cleanup();

        if (!uploadedUrl) {
          reject(
            new Error(
              'Supabase Storage did not return a public URL.'
            )
          );

          return;
        }

        resolve({
          uploadedUrl,
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    }).catch((error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });

    function cleanup() {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup failure.
        }
      }
    }
  });

  inFlightDownloads.set(videoId, promise);

  promise.then(
    () => {
      inFlightDownloads.delete(videoId);
    },
    () => {
      inFlightDownloads.delete(videoId);
    }
  );

  return promise;
}

const failedExtractions = new Map();

function recordExtractionFailure(videoId, message) {
  failedExtractions.set(videoId, {
    error: message || 'Audio extraction failed.',
    timestamp: Date.now(),
  });
}

function getExtractionFailure(videoId) {
  const entry = failedExtractions.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > 120000) {
    failedExtractions.delete(videoId);
    return null;
  }
  return entry.error;
}

// -----------------------------------------------------------------------------
// Stream endpoint
// -----------------------------------------------------------------------------

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({
      error: 'Invalid YouTube video ID.',
    });
  }

  try {
    console.log(
      `[Server] Stream request: ${videoId}`
    );

    // ---------------------------------------------------------
    // 1. Check Supabase cache.
    // ---------------------------------------------------------

    const cachedUrl = await getSupabaseAudioUrl(videoId);

    if (cachedUrl) {
      failedExtractions.delete(videoId);
      console.log(
        `[Server] Cache hit: ${videoId}`
      );

      if (req.query.redirect === 'true') {
        return res.redirect(302, cachedUrl);
      }

      return res.status(200).json({
        status: 'ready',
        url: cachedUrl,
      });
    }

    // ---------------------------------------------------------
    // 2. Check recent failure.
    // ---------------------------------------------------------

    const recentFailure = getExtractionFailure(videoId);
    if (recentFailure) {
      console.log(
        `[Server] Returning recent extraction failure for ${videoId}`
      );
      return res.status(503).json({
        error: recentFailure,
        status: 'error',
      });
    }

    // ---------------------------------------------------------
    // 3. Non-blocking extraction trigger or status check.
    // ---------------------------------------------------------

    if (inFlightDownloads.has(videoId)) {
      console.log(
        `[Server] Extraction in progress: ${videoId}`
      );
      return res.status(202).json({
        status: 'processing',
      });
    }

    console.log(
      `[Server] Cache miss, triggering background extraction: ${videoId}`
    );

    processAndCacheAudio(videoId)
      .then(() => {
        failedExtractions.delete(videoId);
      })
      .catch((error) => {
        console.error(
          `[Server] Background extraction failed for ${videoId}:`,
          error.message
        );
        recordExtractionFailure(videoId, error.message);
      });

    return res.status(202).json({
      status: 'processing',
    });
  } catch (error) {
    console.error(
      `[Server] Stream request handler failed for ${videoId}:`,
      error.message
    );

    if (!res.headersSent) {
      return res.status(503).json({
        error: 'Audio extraction failed.',
      });
    }
  }
});

// -----------------------------------------------------------------------------
// Diagnostic endpoint
// -----------------------------------------------------------------------------

app.get('/health/yt-dlp', async (req, res) => {
  const diagnostics = await getRuntimeDiagnostics();
  if (!diagnostics.ytDlp.available) {
    return res.status(503).json({
      ok: false,
      error: 'yt-dlp is unavailable.',
    });
  }

  return res.json({
    ok: true,
    ytDlpVersion: diagnostics.ytDlp.version,
  });
});

app.get('/health/runtime', async (req, res) => {
  try {
    const diagnostics = await getRuntimeDiagnostics();
    return res.json({
      ok: diagnostics.ytDlp.available,
      nodeVersion: diagnostics.node,
      python: diagnostics.python.available,
      ytDlp: diagnostics.ytDlp.available,
      ytDlpVersion: diagnostics.ytDlp.version,
      ffmpeg: diagnostics.ffmpeg.available,
      ffmpegVersion: diagnostics.ffmpeg.version,
      deno: diagnostics.deno.available,
      denoVersion: diagnostics.deno.version,
      storage: diagnostics.supabaseConfigured,
      cookiesConfigured: diagnostics.cookiesConfigured,
    });
  } catch {
    return res.status(503).json({
      ok: false,
      error: 'Runtime diagnostics unavailable.',
    });
  }
});

// -----------------------------------------------------------------------------
// YouTube metadata search (cached via Supabase search_cache)
// -----------------------------------------------------------------------------

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

app.get('/search', async (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
  const query = rawQuery.trim().toLowerCase();

  if (!query || query.length > 200) {
    return res.status(400).json({
      error: 'A non-empty search query of 200 characters or fewer is required.',
    });
  }

  // 1. Check Supabase search_cache for normalized query created within last 24 hours
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('search_cache')
        .select('results, created_at')
        .eq('query', query)
        .maybeSingle();

      if (!error && data) {
        const createdAtTime = new Date(data.created_at).getTime();
        const ageMs = Date.now() - createdAtTime;
        const isFresh = ageMs < SEARCH_CACHE_TTL_MS;
        const hasResults = Array.isArray(data.results) && data.results.length > 0;

        if (isFresh && hasResults) {
          console.log(`[YouTube Search] [CACHE HIT] query="${query}" age=${Math.round(ageMs / 1000)}s count=${data.results.length}`);
          return res.json(data.results);
        }
      }
    } catch (cacheErr) {
      console.warn('[YouTube Search] Cache check error:', cacheErr.message);
    }
  }

  console.log(`[YouTube Search] [CACHE MISS] query="${query}" - querying YouTube API`);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[YouTube Search] YOUTUBE_API_KEY is not configured.');
    return res.status(500).json({
      error: 'YouTube search is not configured.',
    });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '10',
    q: query,
    key: apiKey,
  });
  const requestUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q=${encodeURIComponent(query)}&key=[redacted]`;

  try {
    console.info('[YouTube Search] Request', { requestUrl, query });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    const errorReason = sanitizeDiagnosticText(payload?.error?.errors?.[0]?.reason || payload?.error?.status || '') || null;
    const errorMessage = sanitizeDiagnosticText(payload?.error?.message || '') || null;

    console.info('[YouTube Search] Response', {
      status: response.status,
      query,
      items: Array.isArray(payload?.items) ? payload.items.length : 0,
      reason: errorReason,
      message: errorMessage,
    });

    if (!response.ok) {
      const isQuotaExceeded =
        response.status === 429 ||
        errorReason === 'quotaExceeded' ||
        errorReason === 'dailyLimitExceeded' ||
        errorReason === 'rateLimitExceeded' ||
        errorReason === 'userRateLimitExceeded' ||
        (errorMessage && /quota|rate\s*limit/i.test(errorMessage));

      if (isQuotaExceeded) {
        console.error('[YouTube Search] Quota/Rate-limit exceeded', {
          status: response.status,
          reason: errorReason,
          message: errorMessage,
        });
        return res.status(503).json({
          error: 'quota_exceeded',
          message: 'Daily search quota reached. Try again later.',
        });
      }

      if (response.status === 401 || response.status === 403) {
        console.error('[YouTube Search] Authorization failure', {
          status: response.status,
          reason: errorReason,
          message: errorMessage,
        });
        return res.status(502).json({
          error: 'YouTube search authorization failed.',
        });
      }

      console.error('[YouTube Search] Upstream failure', {
        status: response.status,
        reason: errorReason,
        message: errorMessage,
      });
      return res.status(502).json({ error: 'YouTube search is temporarily unavailable.' });
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const results = items
      .map((item) => ({
        videoId: typeof item?.id?.videoId === 'string' ? item.id.videoId : '',
        title: typeof item?.snippet?.title === 'string' ? item.snippet.title : '',
        channelTitle: typeof item?.snippet?.channelTitle === 'string' ? item.snippet.channelTitle : '',
        thumbnail: typeof item?.snippet?.thumbnails?.high?.url === 'string'
          ? item.snippet.thumbnails.high.url
          : typeof item?.snippet?.thumbnails?.default?.url === 'string'
            ? item.snippet.thumbnails.default.url
            : '',
      }))
      .filter((item) => item.videoId && item.title);

    // Write to search_cache and perform opportunistic cleanup
    if (supabase && results.length > 0) {
      // Upsert cache row (overwrites existing row for that query, sets created_at to now())
      supabase
        .from('search_cache')
        .upsert({
          query,
          results,
          created_at: new Date().toISOString(),
        }, { onConflict: 'query' })
        .then(({ error: upsertErr }) => {
          if (upsertErr) {
            console.warn('[YouTube Search] Failed to write cache:', upsertErr.message);
          } else {
            console.log(`[YouTube Search] Cached ${results.length} results for query="${query}"`);
          }
        })
        .catch((err) => console.warn('[YouTube Search] Cache upsert error:', err.message));

      // Opportunistic cleanup: delete search_cache rows older than 48 hours
      const cleanupThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      supabase
        .from('search_cache')
        .delete()
        .lt('created_at', cleanupThreshold)
        .then(({ error: deleteErr }) => {
          if (deleteErr) {
            console.warn('[YouTube Search] Cache cleanup error:', deleteErr.message);
          }
        })
        .catch((err) => console.warn('[YouTube Search] Cache cleanup error:', err.message));
    }

    return res.json(results);
  } catch (error) {
    console.error('[YouTube Search] Network failure', {
      query,
      message: sanitizeDiagnosticText(error instanceof Error ? error.message : error),
    });
    return res.status(502).json({ error: 'Unable to reach YouTube search.' });
  }
});

// -----------------------------------------------------------------------------
// Trending endpoint (cached via Supabase)
// -----------------------------------------------------------------------------

const TRENDING_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TRENDING_CACHE_KEY = 'global_trending_v2';
const TRENDING_QUERIES = [
  'The Weeknd official music video',
  'Billie Eilish official music video',
  'Taylor Swift official music video',
  'Dua Lipa official music video',
  'Bruno Mars Lady Gaga official music video',
  'Sabrina Carpenter official music video',
  'Post Malone official music video',
  'Kendrick Lamar official audio',
  'SZA official music video',
  'Olivia Rodrigo official music video',
];

const SPAM_COMPILATION_REGEX = /\b(mix|top\s*\d+|non\s*stop|nonstop|compilation|playlist|full\s*album|full\s*tracklist|mashup|megamix|\d+\s*hours?|best\s*songs|greatest\s*hits|jukebox|audio\s*jukebox|all\s*songs|collection)\b|[~〜]/i;

function isPlayableSingleTrack(track) {
  if (!track || !track.title || !track.videoId) return false;
  return !SPAM_COMPILATION_REGEX.test(track.title);
}

async function searchYouTubeForTrending(query, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '10',
    q: query,
    key: apiKey,
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({}));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item) => ({
      videoId: typeof item?.id?.videoId === 'string' ? item.id.videoId : '',
      title: typeof item?.snippet?.title === 'string' ? item.snippet.title : '',
      channelTitle: typeof item?.snippet?.channelTitle === 'string' ? item.snippet.channelTitle : '',
      thumbnail: typeof item?.snippet?.thumbnails?.high?.url === 'string'
        ? item.snippet.thumbnails.high.url
        : typeof item?.snippet?.thumbnails?.default?.url === 'string'
          ? item.snippet.thumbnails.default.url
          : '',
    }))
    .filter((item) => item.videoId && item.title && isPlayableSingleTrack(item));
}

app.get('/trending', async (req, res) => {
  try {
    let cachedRow = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('trending_cache')
        .select('results, fetched_at')
        .eq('query', TRENDING_CACHE_KEY)
        .maybeSingle();

      if (!error && data) {
        cachedRow = data;
        const fetchedTime = new Date(data.fetched_at).getTime();
        const isFresh = Date.now() - fetchedTime < TRENDING_CACHE_TTL_MS;
        const hasResults = Array.isArray(data.results) && data.results.length > 0;

        if (isFresh && hasResults) {
          const cleanResults = data.results.filter(isPlayableSingleTrack);
          if (cleanResults.length > 0) {
            console.info('[Trending] Serving fresh trending cache', {
              trackCount: cleanResults.length,
              ageMinutes: Math.round((Date.now() - fetchedTime) / 60000),
            });
            return res.json(cleanResults);
          }
        }
      }
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      if (cachedRow?.results && Array.isArray(cachedRow.results)) {
        console.warn('[Trending] YOUTUBE_API_KEY missing, serving stale cache');
        return res.json(cachedRow.results.filter(isPlayableSingleTrack));
      }
      return res.status(500).json({ error: 'Trending search is not configured.' });
    }

    console.info('[Trending] Refreshing trending cache from YouTube queries');
    const searchResults = await Promise.allSettled(
      TRENDING_QUERIES.map((q) => searchYouTubeForTrending(q, apiKey))
    );

    const combined = [];
    const seenIds = new Set();

    for (const result of searchResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        for (const track of result.value) {
          if (!seenIds.has(track.videoId) && isPlayableSingleTrack(track)) {
            seenIds.add(track.videoId);
            combined.push(track);
          }
          if (combined.length >= 30) break;
        }
      }
      if (combined.length >= 30) break;
    }

    if (combined.length > 0) {
      if (supabase) {
        const { error: upsertError } = await supabase
          .from('trending_cache')
          .upsert({
            query: TRENDING_CACHE_KEY,
            results: combined,
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'query' });

        if (upsertError) {
          console.warn('[Trending] Failed to save cache:', upsertError.message);
        }
      }

      return res.json(combined);
    }

    // Fallback to stale cache if YouTube yielded no results
    if (cachedRow?.results && Array.isArray(cachedRow.results)) {
      console.warn('[Trending] Search yielded 0 results, falling back to stale cache');
      return res.json(cachedRow.results.filter(isPlayableSingleTrack));
    }

    return res.json([]);
  } catch (error) {
    console.error('[Trending] Endpoint failed:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve trending tracks.' });
  }
});

// -----------------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `NebulaMusic Server running on port ${PORT}`
  );
  logRuntimeDiagnostics();
});
