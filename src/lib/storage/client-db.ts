/**
 * Pure Client-Side Database for UTA-VERSE (Echo Music Model)
 * Uses browser-native IndexedDB for zero cloud storage, zero quota limits,
 * and 100% offline-ready user library management.
 */

import type { LikedTrack, Playlist, PlaylistWithTracks, Track, TopArtist, ListeningHistoryEntry } from "@/types/music";

const DB_NAME = "utaverse_db";
const DB_VERSION = 1;

interface StoredLikedTrack {
  trackId: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  likedAt: string;
}

interface StoredPlaylistItem {
  trackId: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  addedAt: string;
  position: number;
}

export interface StoredPlaylist {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: StoredPlaylistItem[];
}

interface StoredHistoryItem {
  trackId: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  lastPlayedAt: string;
  playCount: number;
  totalListenedSeconds: number;
}

interface StoredProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  updatedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("likes")) {
        db.createObjectStore("likes", { keyPath: "trackId" });
      }
      if (!db.objectStoreNames.contains("playlists")) {
        db.createObjectStore("playlists", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("history")) {
        db.createObjectStore("history", { keyPath: "trackId" });
      }
      if (!db.objectStoreNames.contains("profile")) {
        db.createObjectStore("profile", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  storeName: "likes" | "playlists" | "history" | "profile",
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request: IDBRequest<T> | undefined;

      try {
        const res = callback(store);
        if (res) request = res;
      } catch (err) {
        reject(err);
        return;
      }

      tx.oncomplete = () => {
        resolve(request ? request.result : (undefined as unknown as T));
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIKED TRACKS
// ─────────────────────────────────────────────────────────────────────────────

export async function dbGetLikedTracks(): Promise<LikedTrack[]> {
  try {
    const all = await runTransaction<StoredLikedTrack[]>("likes", "readonly", (store) => store.getAll());
    return (all ?? [])
      .sort((a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime())
      .map((item) => ({
        trackId: item.trackId,
        likedAt: item.likedAt,
      }));
  } catch (error) {
    console.warn("[ClientDB] dbGetLikedTracks failed:", error);
    return [];
  }
}

export async function dbGetLikedTracksWithDetails(): Promise<Track[]> {
  try {
    const all = await runTransaction<StoredLikedTrack[]>("likes", "readonly", (store) => store.getAll());
    return (all ?? [])
      .sort((a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime())
      .map((item) => ({
        id: item.trackId,
        title: item.title,
        artist: item.artist,
        album: "",
        artwork: item.artwork,
        duration: item.duration,
      }));
  } catch (error) {
    console.warn("[ClientDB] dbGetLikedTracksWithDetails failed:", error);
    return [];
  }
}

export async function dbIsTrackLiked(trackId: string): Promise<boolean> {
  try {
    const item = await runTransaction<StoredLikedTrack | undefined>("likes", "readonly", (store) => store.get(trackId));
    return Boolean(item);
  } catch {
    return false;
  }
}

export async function dbGetLikedTrackIds(): Promise<Set<string>> {
  try {
    const all = await runTransaction<StoredLikedTrack[]>("likes", "readonly", (store) => store.getAll());
    return new Set((all ?? []).map((t) => t.trackId));
  } catch {
    return new Set();
  }
}

export async function dbToggleLikeTrack(
  trackId: string,
  meta: { title: string; artist: string; artwork: string; duration: number }
): Promise<boolean> {
  const isCurrentlyLiked = await dbIsTrackLiked(trackId);

  if (isCurrentlyLiked) {
    await runTransaction("likes", "readwrite", (store) => {
      store.delete(trackId);
    });
    return false;
  } else {
    const newItem: StoredLikedTrack = {
      trackId,
      title: meta.title,
      artist: meta.artist,
      artwork: meta.artwork,
      duration: meta.duration,
      likedAt: new Date().toISOString(),
    };
    await runTransaction("likes", "readwrite", (store) => {
      store.put(newItem);
    });
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLISTS
// ─────────────────────────────────────────────────────────────────────────────

function toPlaylistModel(sp: StoredPlaylist): Playlist {
  const trackCount = sp.tracks.length;
  const firstArt = sp.coverUrl || (sp.tracks[0]?.artwork ?? null);
  const totalDuration = sp.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return {
    id: sp.id,
    userId: "local-user",
    name: sp.name,
    description: sp.description,
    coverUrl: firstArt,
    folderId: null,
    isPublic: false,
    trackCount,
    totalDuration,
    createdAt: sp.createdAt,
  };
}

export async function dbGetUserPlaylists(): Promise<Playlist[]> {
  try {
    const all = await runTransaction<StoredPlaylist[]>("playlists", "readonly", (store) => store.getAll());
    return (all ?? [])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(toPlaylistModel);
  } catch (error) {
    console.warn("[ClientDB] dbGetUserPlaylists failed:", error);
    return [];
  }
}

export async function dbGetPlaylistById(playlistId: string): Promise<PlaylistWithTracks | null> {
  try {
    const item = await runTransaction<StoredPlaylist | undefined>("playlists", "readonly", (store) => store.get(playlistId));
    if (!item) return null;

    const base = toPlaylistModel(item);
    const tracks: Track[] = item.tracks.map((t) => ({
      id: t.trackId,
      title: t.title,
      artist: t.artist,
      album: "",
      artwork: t.artwork,
      duration: t.duration,
      addedAt: t.addedAt,
    }));

    return {
      ...base,
      tracks,
    };
  } catch (error) {
    console.warn(`[ClientDB] dbGetPlaylistById ${playlistId} failed:`, error);
    return null;
  }
}

export async function dbCreatePlaylist(name: string, description?: string): Promise<Playlist> {
  const id = "pl_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  const now = new Date().toISOString();

  const newPlaylist: StoredPlaylist = {
    id,
    name: name.trim() || "My Playlist",
    description: description?.trim() || "",
    coverUrl: null,
    createdAt: now,
    updatedAt: now,
    tracks: [],
  };

  await runTransaction("playlists", "readwrite", (store) => {
    store.put(newPlaylist);
  });

  return toPlaylistModel(newPlaylist);
}

export async function dbUpdatePlaylist(
  id: string,
  updates: { name?: string; description?: string; coverUrl?: string | null }
): Promise<Playlist> {
  const item = await runTransaction<StoredPlaylist | undefined>("playlists", "readonly", (store) => store.get(id));
  if (!item) throw new Error("Playlist not found");

  const updated: StoredPlaylist = {
    ...item,
    name: updates.name !== undefined ? updates.name.trim() : item.name,
    description: updates.description !== undefined ? updates.description.trim() : item.description,
    coverUrl: updates.coverUrl !== undefined ? updates.coverUrl : item.coverUrl,
    updatedAt: new Date().toISOString(),
  };

  await runTransaction("playlists", "readwrite", (store) => {
    store.put(updated);
  });

  return toPlaylistModel(updated);
}

export async function dbDeletePlaylist(id: string): Promise<void> {
  await runTransaction("playlists", "readwrite", (store) => {
    store.delete(id);
  });
}

export async function dbAddTrackToPlaylist(
  playlistId: string,
  track: { id: string; title: string; artist: string; artwork?: string; duration?: number }
): Promise<void> {
  const item = await runTransaction<StoredPlaylist | undefined>("playlists", "readonly", (store) => store.get(playlistId));
  if (!item) throw new Error("Playlist not found");

  // Prevent duplicate track addition if already in playlist
  if (item.tracks.some((t) => t.trackId === track.id)) {
    return;
  }

  const newTrack: StoredPlaylistItem = {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    artwork: track.artwork || "",
    duration: track.duration || 0,
    addedAt: new Date().toISOString(),
    position: item.tracks.length,
  };

  item.tracks.push(newTrack);
  item.updatedAt = new Date().toISOString();

  await runTransaction("playlists", "readwrite", (store) => {
    store.put(item);
  });
}

export async function dbRemoveTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const item = await runTransaction<StoredPlaylist | undefined>("playlists", "readonly", (store) => store.get(playlistId));
  if (!item) return;

  item.tracks = item.tracks.filter((t) => t.trackId !== trackId);
  // Re-index positions
  item.tracks.forEach((t, index) => {
    t.position = index;
  });
  item.updatedAt = new Date().toISOString();

  await runTransaction("playlists", "readwrite", (store) => {
    store.put(item);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTENING HISTORY & STATS
// ─────────────────────────────────────────────────────────────────────────────

export async function dbRecordListeningHistory(
  trackId: string,
  meta: { title: string; artist: string; artwork: string; duration: number },
  listenedSeconds = 30
): Promise<void> {
  try {
    const existing = await runTransaction<StoredHistoryItem | undefined>("history", "readonly", (store) =>
      store.get(trackId)
    );

    const now = new Date().toISOString();
    const updated: StoredHistoryItem = {
      trackId,
      title: meta.title,
      artist: meta.artist,
      artwork: meta.artwork,
      duration: meta.duration,
      lastPlayedAt: now,
      playCount: (existing?.playCount ?? 0) + 1,
      totalListenedSeconds: (existing?.totalListenedSeconds ?? 0) + listenedSeconds,
    };

    await runTransaction("history", "readwrite", (store) => {
      store.put(updated);
    });
  } catch (error) {
    console.warn("[ClientDB] dbRecordListeningHistory failed:", error);
  }
}

export async function dbGetRecentlyPlayed(limit = 20): Promise<Track[]> {
  try {
    const all = await runTransaction<StoredHistoryItem[]>("history", "readonly", (store) => store.getAll());
    return (all ?? [])
      .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime())
      .slice(0, limit)
      .map((item) => ({
        id: item.trackId,
        title: item.title,
        artist: item.artist,
        album: "",
        artwork: item.artwork,
        duration: item.duration,
      }));
  } catch (error) {
    console.warn("[ClientDB] dbGetRecentlyPlayed failed:", error);
    return [];
  }
}

export async function dbGetTopArtists(limit = 10): Promise<TopArtist[]> {
  try {
    const all = await runTransaction<StoredHistoryItem[]>("history", "readonly", (store) => store.getAll());
    const artistMap = new Map<string, { playCount: number; artwork: string }>();

    for (const item of all ?? []) {
      const existing = artistMap.get(item.artist);
      if (existing) {
        existing.playCount += item.playCount;
        if (!existing.artwork && item.artwork) existing.artwork = item.artwork;
      } else {
        artistMap.set(item.artist, {
          playCount: item.playCount,
          artwork: item.artwork || "",
        });
      }
    }

    return Array.from(artistMap.entries())
      .sort((a, b) => b[1].playCount - a[1].playCount)
      .slice(0, limit)
      .map(([artist, data]) => ({
        name: artist,
        count: data.playCount,
        artwork: data.artwork,
      }));
  } catch (error) {
    console.warn("[ClientDB] dbGetTopArtists failed:", error);
    return [];
  }
}

export async function dbGetUserStats() {
  try {
    const all = await runTransaction<StoredHistoryItem[]>("history", "readonly", (store) => store.getAll());
    const totalPlays = (all ?? []).reduce((acc, i) => acc + i.playCount, 0);
    const totalSeconds = (all ?? []).reduce((acc, i) => acc + i.totalListenedSeconds, 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    return {
      totalPlays,
      totalMinutes,
      uniqueTracks: (all ?? []).length,
    };
  } catch {
    return { totalPlays: 0, totalMinutes: 0, uniqueTracks: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKUP & RESTORE (Echo Music Feature)
// ─────────────────────────────────────────────────────────────────────────────

export interface LibraryBackup {
  version: number;
  exportedAt: string;
  likes: StoredLikedTrack[];
  playlists: StoredPlaylist[];
  history: StoredHistoryItem[];
}

export async function dbExportLibraryBackup(): Promise<string> {
  const [likes, playlists, history] = await Promise.all([
    runTransaction<StoredLikedTrack[]>("likes", "readonly", (s) => s.getAll()),
    runTransaction<StoredPlaylist[]>("playlists", "readonly", (s) => s.getAll()),
    runTransaction<StoredHistoryItem[]>("history", "readonly", (s) => s.getAll()),
  ]);

  const backup: LibraryBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    likes: likes ?? [],
    playlists: playlists ?? [],
    history: history ?? [],
  };

  return JSON.stringify(backup, null, 2);
}

export async function dbImportLibraryBackup(jsonString: string): Promise<{ likes: number; playlists: number }> {
  const backup = JSON.parse(jsonString) as LibraryBackup;
  if (!backup || typeof backup !== "object") {
    throw new Error("Invalid backup format");
  }

  let importedLikes = 0;
  let importedPlaylists = 0;

  if (Array.isArray(backup.likes)) {
    for (const item of backup.likes) {
      if (item.trackId) {
        await runTransaction("likes", "readwrite", (s) => s.put(item));
        importedLikes++;
      }
    }
  }

  if (Array.isArray(backup.playlists)) {
    for (const pl of backup.playlists) {
      if (pl.id && pl.name) {
        await runTransaction("playlists", "readwrite", (s) => s.put(pl));
        importedPlaylists++;
      }
    }
  }

  return { likes: importedLikes, playlists: importedPlaylists };
}
