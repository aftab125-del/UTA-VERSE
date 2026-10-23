import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database, Tables } from "@/types/database";
import type { Playlist, PlaylistFolder, PlaylistWithTracks, Track } from "@/types/music";
import {
  dbGetUserPlaylists,
  dbGetPlaylistById,
  dbCreatePlaylist,
  dbUpdatePlaylist,
  dbDeletePlaylist,
  dbAddTrackToPlaylist,
  dbRemoveTrackFromPlaylist,
} from "@/lib/storage/client-db";

type Client = SupabaseClient<Database>;

function getClient(client?: Client): Client {
  return client ?? createSupabaseBrowserClient();
}

type PlaylistRow = Tables<"playlists">;

/** Subset of Track fields we denormalize into playlist_tracks. */
interface TrackMeta {
  title: string;
  artist: string;
  artwork: string;
  duration: number;
}

function mapPlaylist(
  row: PlaylistRow & {
    playlist_tracks?: Array<{ count?: number; artwork?: string | null; position?: number }>;
  }
): Playlist {
  const tracks = row.playlist_tracks ?? [];
  const trackCount =
    tracks[0] && typeof tracks[0].count === "number"
      ? (tracks[0].count as number)
      : tracks.length;

  let firstArt: string | null = null;
  if (!row.cover_url && tracks.length > 0) {
    let minPos = Infinity;
    for (const t of tracks) {
      if (t.artwork && (t.position ?? 0) < minPos) {
        minPos = t.position ?? 0;
        firstArt = t.artwork;
      }
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url || firstArt,
    folderId: row.folder_id,
    isPublic: row.is_public,
    trackCount,
    totalDuration: 0,
    createdAt: row.created_at,
  };
}

// ── Playlist CRUD ─────────────────────────────────────────────────────────────

export async function getUserPlaylists(userId: string, client?: Client): Promise<Playlist[]> {
  // 1. Primary in browser: Fetch instantly from IndexedDB
  let localPlaylists: Playlist[] = [];
  if (typeof window !== "undefined") {
    try {
      localPlaylists = await dbGetUserPlaylists();
    } catch {
      // ignore
    }
  }

  // 2. Secondary: If cloud Supabase is available and user is authenticated
  if (userId && userId !== "local-user") {
    try {
      const { data, error } = await getClient(client)
        .from("playlists")
        .select("*, playlist_tracks(artwork, position)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const cloudPlaylists = (data as unknown as Parameters<typeof mapPlaylist>[0][]).map((row) => mapPlaylist(row));
        const localIds = new Set(localPlaylists.map((p) => p.id));
        const merged = [...localPlaylists];
        for (const cp of cloudPlaylists) {
          if (!localIds.has(cp.id)) merged.push(cp);
        }
        return merged;
      }
    } catch {
      // Cloud restricted or offline; local IndexedDB persists
    }
  }

  return localPlaylists;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
}

/** Fast, lightweight query for playlist picker: fetches only id, name, and count without bulky artworks or tracks */
export async function getUserPlaylistsSummary(userId: string, client?: Client): Promise<PlaylistSummary[]> {
  const playlists = await getUserPlaylists(userId, client);
  return playlists.map((p) => ({
    id: p.id,
    name: p.name,
    trackCount: p.trackCount,
  }));
}

export async function getPlaylistById(playlistId: string, client?: Client): Promise<Playlist | null> {
  if (typeof window !== "undefined") {
    try {
      const local = await dbGetPlaylistById(playlistId);
      if (local) return local;
    } catch {
      // ignore
    }
  }

  try {
    const { data, error } = await getClient(client)
      .from("playlists")
      .select("*, playlist_tracks(artwork, position)")
      .eq("id", playlistId)
      .maybeSingle();
    if (!error && data) return mapPlaylist(data as unknown as Parameters<typeof mapPlaylist>[0]);
  } catch {
    // ignore
  }

  return null;
}

/**
 * Load a playlist and its tracks. Track objects are constructed entirely
 * from denormalized metadata stored in playlist_tracks — no catalog join.
 */
export async function getPlaylistWithTracks(playlistId: string, client?: Client): Promise<PlaylistWithTracks | null> {
  // 1. Primary: Local IndexedDB lookup
  if (typeof window !== "undefined") {
    try {
      const local = await dbGetPlaylistById(playlistId);
      if (local) return local;
    } catch {
      // ignore
    }
  }

  // 2. Secondary: Cloud Supabase lookup
  try {
    const supabase = getClient(client);
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("*, playlist_tracks(artwork, position)")
      .eq("id", playlistId)
      .maybeSingle();

    if (playlistError || !playlist) return null;

    const { data: playlistTracks, error: ptError } = await supabase
      .from("playlist_tracks")
      .select("track_id, position, title, artist, artwork, duration")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });

    if (ptError) return null;

    const tracks: Track[] = (playlistTracks ?? []).map((pt) => {
      const rawId = pt.track_id || "";
      const videoId = rawId.startsWith("youtube:")
        ? rawId.replace(/^youtube:/, "")
        : /^[A-Za-z0-9_-]{11}$/.test(rawId)
        ? rawId
        : undefined;
      return {
        id: pt.track_id,
        videoId,
        title: pt.title || "Untitled",
        artist: pt.artist || "Unknown artist",
        album: "",
        artwork: pt.artwork,
        duration: pt.duration,
      };
    });

    const base = mapPlaylist(playlist as unknown as Parameters<typeof mapPlaylist>[0]);
    const effectiveCover = base.coverUrl || tracks.find((t) => Boolean(t.artwork))?.artwork || null;
    return { ...base, coverUrl: effectiveCover, tracks };
  } catch {
    return null;
  }
}

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
  client?: Client,
): Promise<Playlist> {
  // 1. Always create locally in IndexedDB (instant, 0 quota)
  let localPlaylist: Playlist | null = null;
  if (typeof window !== "undefined") {
    try {
      localPlaylist = await dbCreatePlaylist(name, description);
    } catch (err) {
      console.warn("[Playlists] Local playlist creation error:", err);
    }
  }

  // 2. Best-effort background cloud sync
  if (userId && userId !== "local-user") {
    try {
      const { data, error } = await getClient(client)
        .from("playlists")
        .insert({ user_id: userId, name, description: description ?? null })
        .select("*, playlist_tracks(artwork, position)")
        .single();
      if (!error && data) {
        return mapPlaylist(data as unknown as Parameters<typeof mapPlaylist>[0]);
      }
    } catch {
      // Supabase restricted or offline; local playlist returned
    }
  }

  if (localPlaylist) return localPlaylist;

  return {
    id: "pl_" + Math.random().toString(36).substring(2, 9),
    userId: userId || "local-user",
    name: name || "My Playlist",
    description: description || "",
    coverUrl: null,
    folderId: null,
    isPublic: false,
    trackCount: 0,
    totalDuration: 0,
    createdAt: new Date().toISOString(),
  };
}

export async function updatePlaylist(
  playlistId: string,
  updates: { name?: string; description?: string | null; cover_url?: string | null; folder_id?: string | null; is_public?: boolean },
  client?: Client,
): Promise<Playlist> {
  // 1. Local update
  if (typeof window !== "undefined") {
    try {
      const res = await dbUpdatePlaylist(playlistId, {
        name: updates.name,
        description: updates.description ?? undefined,
        coverUrl: updates.cover_url ?? undefined,
      });
      return res;
    } catch {
      // ignore
    }
  }

  // 2. Cloud update
  const { data, error } = await getClient(client)
    .from("playlists")
    .update(updates)
    .eq("id", playlistId)
    .select("*, playlist_tracks(artwork, position)")
    .single();
  if (error) throw new Error(`Unable to update playlist: ${error.message}`);
  return mapPlaylist(data as unknown as Parameters<typeof mapPlaylist>[0]);
}

export async function deletePlaylist(playlistId: string, client?: Client): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      await dbDeletePlaylist(playlistId);
    } catch {
      // ignore
    }
  }

  try {
    await getClient(client).from("playlists").delete().eq("id", playlistId);
  } catch {
    // ignore
  }
}

export async function duplicatePlaylist(
  playlistId: string,
  userId: string,
  newName?: string,
  client?: Client,
): Promise<Playlist> {
  const source = await getPlaylistWithTracks(playlistId, client);
  if (!source) throw new Error("Source playlist not found");

  const newPlaylist = await createPlaylist(userId, newName ?? `${source.name} (Copy)`, source.description ?? undefined, client);

  if (source.tracks.length > 0) {
    for (const track of source.tracks) {
      await addTrackToPlaylist(
        newPlaylist.id,
        track.id,
        {
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
          duration: track.duration,
        },
        undefined,
        client
      );
    }
  }

  return newPlaylist;
}

// ── Playlist track management ─────────────────────────────────────────────────

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
  meta: TrackMeta,
  position?: number,
  client?: Client,
): Promise<void> {
  // 1. Add locally
  if (typeof window !== "undefined") {
    try {
      await dbAddTrackToPlaylist(playlistId, {
        id: trackId,
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artwork,
        duration: meta.duration,
      });
    } catch {
      // ignore
    }
  }

  // 2. Best effort cloud sync
  try {
    const supabase = getClient(client);
    if (position === undefined) {
      const { data: existing } = await supabase
        .from("playlist_tracks")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);
      position = existing && existing.length > 0 ? existing[0].position + 1 : 0;
    }

    await supabase.from("playlist_tracks").upsert(
      { playlist_id: playlistId, track_id: trackId, position, ...meta },
      { onConflict: "playlist_id,track_id" },
    );
  } catch {
    // ignore cloud error
  }
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
  client?: Client,
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      await dbRemoveTrackFromPlaylist(playlistId, trackId);
    } catch {
      // ignore
    }
  }

  try {
    await getClient(client)
      .from("playlist_tracks")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);
  } catch {
    // ignore
  }
}

export async function reorderPlaylistTracks(
  playlistId: string,
  trackIds: string[],
  client?: Client,
): Promise<void> {
  try {
    const supabase = getClient(client);
    const updates = trackIds.map((trackId, index) =>
      supabase
        .from("playlist_tracks")
        .update({ position: index })
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId),
    );
    await Promise.all(updates);
  } catch {
    // ignore
  }
}

// ── Playlist folders ──────────────────────────────────────────────────────────

export async function getUserFolders(userId: string, client?: Client): Promise<PlaylistFolder[]> {
  try {
    const { data, error } = await getClient(client)
      .from("playlist_folders")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error) return [];
    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createFolder(userId: string, name: string, client?: Client): Promise<PlaylistFolder> {
  const { data, error } = await getClient(client)
    .from("playlist_folders")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw new Error(`Unable to create folder: ${error.message}`);
  return { id: data.id, userId: data.user_id, name: data.name, position: data.position, createdAt: data.created_at };
}

export async function updateFolder(
  folderId: string,
  updates: { name?: string; position?: number },
  client?: Client,
): Promise<void> {
  await getClient(client).from("playlist_folders").update(updates).eq("id", folderId);
}

export async function deleteFolder(folderId: string, client?: Client): Promise<void> {
  await getClient(client).from("playlist_folders").delete().eq("id", folderId);
}
