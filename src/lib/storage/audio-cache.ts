/**
 * Browser-native Audio Cache Store using IndexedDB.
 * Stores downloaded audio blobs for instantaneous, zero-network-latency repeat playback.
 * Modeled after Echo Music's DynamicLruCacheEvictor.
 */

const AUDIO_CACHE_DB = "utaverse_audio_cache";
const AUDIO_CACHE_STORE = "audio_blobs";
const MAX_CACHE_ENTRIES = 50; // Keep up to 50 songs locally in browser

interface CachedAudioEntry {
  videoId: string;
  blob: Blob;
  mimeType: string;
  cachedAt: number;
  lastAccessedAt: number;
  size: number;
}

function openAudioCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const req = window.indexedDB.open(AUDIO_CACHE_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUDIO_CACHE_STORE)) {
        const store = db.createObjectStore(AUDIO_CACHE_STORE, { keyPath: "videoId" });
        store.createIndex("lastAccessedAt", "lastAccessedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Checks if a track's audio is already cached in IndexedDB.
 * Returns an instant object URL (blob:...) or null if not cached.
 */
export async function getCachedAudioBlobUrl(videoId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await openAudioCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction(AUDIO_CACHE_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_CACHE_STORE);
      const req = store.get(videoId);
      req.onsuccess = () => {
        const entry = req.result as CachedAudioEntry | undefined;
        if (entry?.blob) {
          entry.lastAccessedAt = Date.now();
          store.put(entry);
          resolve(URL.createObjectURL(entry.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Caches an audio blob into IndexedDB with LRU eviction.
 */
export async function cacheAudioBlob(videoId: string, blob: Blob, mimeType: string): Promise<void> {
  if (typeof window === "undefined" || !videoId || !blob || blob.size === 0) return;
  try {
    const db = await openAudioCacheDB();
    const tx = db.transaction(AUDIO_CACHE_STORE, "readwrite");
    const store = tx.objectStore(AUDIO_CACHE_STORE);
    const entry: CachedAudioEntry = {
      videoId,
      blob,
      mimeType,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
      size: blob.size,
    };
    store.put(entry);

    // Evict oldest if exceeding capacity
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_CACHE_ENTRIES) {
        const index = store.index("lastAccessedAt");
        const cursorReq = index.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
          }
        };
      }
    };
  } catch {
    // Ignore cache storage errors
  }
}
