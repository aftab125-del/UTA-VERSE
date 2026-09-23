import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Allow long-running batch storage deletions (up to 60s)
export const maxDuration = 60;

const AUDIO_BUCKET = process.env.AUDIO_CACHE_BUCKET || "audio-cache";
// 7 days default retention
const DEFAULT_TTL_DAYS = 7;
// Target ceiling: 600 MB (quota is 1.0 GB)
const TARGET_MAX_BYTES = 600 * 1024 * 1024;
// Evict down to safe buffer: 500 MB
const TARGET_SAFE_BYTES = 500 * 1024 * 1024;
// Average fallback file size estimate if DB has 0: 4 MB
const ESTIMATED_FILE_SIZE_BYTES = 4 * 1024 * 1024;

interface CleanupResult {
  success: boolean;
  ttlDays: number;
  totalFilesInBucket: number;
  totalRowsInDb: number;
  ttlEvictedCount: number;
  lruEvictedCount: number;
  orphanFilesPurgedCount: number;
  totalFilesDeleted: number;
  totalBytesFreed: number;
  estimatedRemainingBytes: number;
  durationMs: number;
  message: string;
  warning?: string;
}

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key") || url.searchParams.get("secret");

  // In production, require either CRON_SECRET or service key match
  const provided = bearerToken || queryKey;
  if (cronSecret && provided === cronSecret) return true;
  if (serviceKey && provided === serviceKey) return true;

  // If neither CRON_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set in development, permit local execution
  if (!cronSecret && process.env.NODE_ENV !== "production") return true;

  return false;
}

async function runStorageCleanup(ttlDays: number = DEFAULT_TTL_DAYS): Promise<CleanupResult> {
  const startTime = Date.now();
  const supabase = createSupabaseAdminClient();

  // 1. Fetch all bucket objects in pages
  const bucketFileMap = new Map<string, { size: number }>();
  let offset = 0;
  const PAGE_SIZE = 100;

  while (true) {
    const { data: page, error: listError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .list("", { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

    if (listError) {
      console.error("[StorageCleanup] Failed to list storage bucket:", listError.message);
      break;
    }
    if (!page || page.length === 0) break;

    for (const item of page) {
      if (item.name && item.name.endsWith(".m4a")) {
        const size = (item.metadata as { size?: number } | undefined)?.size || 0;
        bucketFileMap.set(item.name, { size });
      }
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // 2. Query all metadata records from playback_cache
  const { data: rows, error: rowsError } = await supabase
    .from("playback_cache")
    .select("video_id, title, artist, file_size, created_at, last_played_at");

  if (rowsError) {
    console.error("[StorageCleanup] Failed to query playback_cache:", rowsError.message);
    throw new Error(`Database query failed: ${rowsError.message}`);
  }

  const allRows = rows || [];
  const validDbVideoIds = new Set(allRows.map((r) => r.video_id));

  // 3. Classify tracks by 7-day TTL
  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

  const ttlEvictRows: typeof allRows = [];
  const activeRows: typeof allRows = [];

  for (const row of allRows) {
    const lastActive = row.last_played_at || row.created_at;
    if (new Date(lastActive).getTime() < cutoffMs) {
      ttlEvictRows.push(row);
    } else {
      activeRows.push(row);
    }
  }

  // 4. Calculate remaining storage and check if LRU eviction is needed
  // Start with total storage of active rows
  let currentActiveBytes = 0;
  for (const row of activeRows) {
    const fileObj = bucketFileMap.get(`${row.video_id}.m4a`);
    const size = fileObj?.size || row.file_size || ESTIMATED_FILE_SIZE_BYTES;
    currentActiveBytes += size;
  }

  // If active rows exceed target ceiling (600 MB), evict least recently played active tracks until < 500 MB
  const lruEvictRows: typeof allRows = [];
  if (currentActiveBytes > TARGET_MAX_BYTES) {
    // Sort oldest played first
    activeRows.sort((a, b) => {
      const timeA = new Date(a.last_played_at || a.created_at).getTime();
      const timeB = new Date(b.last_played_at || b.created_at).getTime();
      return timeA - timeB;
    });

    while (currentActiveBytes > TARGET_SAFE_BYTES && activeRows.length > 0) {
      const evicted = activeRows.shift();
      if (!evicted) break;
      lruEvictRows.push(evicted);

      const fileObj = bucketFileMap.get(`${evicted.video_id}.m4a`);
      const size = fileObj?.size || evicted.file_size || ESTIMATED_FILE_SIZE_BYTES;
      currentActiveBytes -= size;
    }
  }

  // 5. Identify orphan files in bucket (files in storage with no corresponding row in playback_cache)
  const orphanFileNames: string[] = [];
  let orphanBytes = 0;

  for (const [fileName, fileInfo] of bucketFileMap.entries()) {
    const videoId = fileName.replace(/\.m4a$/, "");
    if (!validDbVideoIds.has(videoId)) {
      orphanFileNames.push(fileName);
      orphanBytes += fileInfo.size;
    }
  }

  // 6. Assemble files to delete from Storage
  const allEvictedRows = [...ttlEvictRows, ...lruEvictRows];
  const filesToDeleteFromBucket = new Set<string>();
  let evictedDbRowsBytes = 0;

  for (const row of allEvictedRows) {
    const fileName = `${row.video_id}.m4a`;
    filesToDeleteFromBucket.add(fileName);
    const fileObj = bucketFileMap.get(fileName);
    evictedDbRowsBytes += fileObj?.size || row.file_size || ESTIMATED_FILE_SIZE_BYTES;
  }

  for (const orphan of orphanFileNames) {
    filesToDeleteFromBucket.add(orphan);
  }

  const filesToDeleteArray = Array.from(filesToDeleteFromBucket);

  // 7. Delete files from Supabase Storage in chunks of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < filesToDeleteArray.length; i += BATCH_SIZE) {
    const chunk = filesToDeleteArray.slice(i, i + BATCH_SIZE);
    const { error: removeError } = await supabase.storage.from(AUDIO_BUCKET).remove(chunk);
    if (removeError) {
      console.warn(`[StorageCleanup] Error deleting batch ${i}-${i + chunk.length}:`, removeError.message);
    }
  }

  // 8. Delete evicted rows from public.playback_cache in chunks
  const videoIdsToDelete = allEvictedRows.map((r) => r.video_id);
  for (let i = 0; i < videoIdsToDelete.length; i += BATCH_SIZE) {
    const idChunk = videoIdsToDelete.slice(i, i + BATCH_SIZE);
    const { error: deleteRowError } = await supabase
      .from("playback_cache")
      .delete()
      .in("video_id", idChunk);

    if (deleteRowError) {
      console.warn(`[StorageCleanup] Error deleting DB rows ${i}-${i + idChunk.length}:`, deleteRowError.message);
    }
  }

  const totalBytesFreed = evictedDbRowsBytes + orphanBytes;
  const durationMs = Date.now() - startTime;

  return {
    success: true,
    ttlDays,
    totalFilesInBucket: bucketFileMap.size,
    totalRowsInDb: allRows.length,
    ttlEvictedCount: ttlEvictRows.length,
    lruEvictedCount: lruEvictRows.length,
    orphanFilesPurgedCount: orphanFileNames.length,
    totalFilesDeleted: filesToDeleteArray.length,
    totalBytesFreed,
    estimatedRemainingBytes: currentActiveBytes,
    durationMs,
    message: `Cleanup completed in ${durationMs}ms: removed ${filesToDeleteArray.length} files (${(totalBytesFreed / (1024 * 1024)).toFixed(2)} MB freed). Estimated active storage: ${(currentActiveBytes / (1024 * 1024)).toFixed(2)} MB.`,
    ...(process.env.SUPABASE_SERVICE_ROLE_KEY
      ? {}
      : {
          warning:
            "SUPABASE_SERVICE_ROLE_KEY is not set in environment. Storage file deletion requires the service_role key to bypass Supabase Storage RLS. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local and Vercel.",
        }),
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized. Provide valid CRON_SECRET via Bearer token or ?key= query parameter." }, { status: 401 });
  }

  const url = new URL(request.url);
  const ttlParam = url.searchParams.get("ttlDays");
  const ttlDays = ttlParam ? Math.max(1, parseInt(ttlParam, 10) || DEFAULT_TTL_DAYS) : DEFAULT_TTL_DAYS;

  try {
    const result = await runStorageCleanup(ttlDays);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage cleanup error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized. Provide valid CRON_SECRET via Bearer token or ?key= query parameter." }, { status: 401 });
  }

  let ttlDays = DEFAULT_TTL_DAYS;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.ttlDays === "number" && body.ttlDays > 0) {
      ttlDays = body.ttlDays;
    }
  } catch {
    // default
  }

  try {
    const result = await runStorageCleanup(ttlDays);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage cleanup error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
