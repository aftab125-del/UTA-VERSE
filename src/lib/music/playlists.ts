import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database, Tables } from "@/types/database";
import type { Playlist, PlaylistFolder, PlaylistWithTracks, Track } from "@/types/music";

type Client = SupabaseClient<Database>;

function getClient(client?: Client): Client {
  return client ?? createSupabaseBrowserClient();
}

type PlaylistRow = Tables<"playlists">;
type PlaylistTrackRow = Tables<"playlist_tracks">;

/** Subset of Track fields we denormalize into playlist_tracks. */
interface TrackMeta {
  title: string;
  artist: string;
  artwork: string;
  duration: number;
}

function mapPlaylist(row: PlaylistRow & { playlist_tracks: { count: number }[] }): Playlist {
  const trackCount = row.playlist_tracks[0]?.count ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url,
    folderId: row.folder_id,
    isPublic: row.is_public,
    trackCount,
    totalDuration: 0,
    createdAt: row.created_at,
  };
}

// ── Playlist CRUD ─────────────────────────────────────────────────────────────

export async function getUserPlaylists(userId: string, client?: Client): Promise<Playlist[]> {
  const { data, error } = await getClient(client)
    .from("playlists")
    .select("*, playlist_tracks(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load playlists: ${error.message}`);
  return data.map((row) => mapPlaylist(row));
}

export async function getPlaylistById(playlistId: string, client?: Client): Promise<Playlist | null> {
  const { data, error } = await getClient(client)
    .from("playlists")
    .select("*, playlist_tracks(count)")
    .eq("id", playlistId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load playlist: ${error.message}`);
  return data ? mapPlaylist(data) : null;
}

/**
 * Load a playlist and its tracks. Track objects are constructed entirely
 * from denormalized metadata stored in playlist_tracks — no catalog join.
 */
export async function getPlaylistWithTracks(playlistId: string, client?: Client): Promise<PlaylistWithTracks | null> {
  const supabase = getClient(client);
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("*, playlist_tracks(count)")
    .eq("id", playlistId)
    .maybeSingle();
  if (playlistError) throw new Error(`Unable to load playlist: ${playlistError.message}`);
  if (!playlist) return null;

  const { data: playlistTracks, error: ptError } = await supabase
    .from("playlist_tracks")
    .select("track_id, position, title, artist, artwork, duration")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
  if (ptError) throw new Error(`Unable to load playlist tracks: ${ptError.message}`);

  const tracks: Track[] = (playlistTracks ?? []).map((pt) => ({
    id: pt.track_id,
    title: pt.title || "Untitled",
    artist: pt.artist || "Unknown artist",
    album: "",
    artwork: pt.artwork,
    duration: pt.duration,
  }));

  const base = mapPlaylist(playlist);
  return { ...base, tracks };
}

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
  client?: Client,
): Promise<Playlist> {
  const { data, error } = await getClient(client)
    .from("playlists")
    .insert({ user_id: userId, name, description: description ?? null })
    .select("*, playlist_tracks(count)")
    .single();
  if (error) throw new Error(`Unable to create playlist: ${error.message}`);
  return mapPlaylist(data);
}

export async function updatePlaylist(
  playlistId: string,
  updates: { name?: string; description?: string | null; cover_url?: string | null; folder_id?: string | null; is_public?: boolean },
  client?: Client,
): Promise<Playlist> {
  const { data, error } = await getClient(client)
    .from("playlists")
    .update(updates)
    .eq("id", playlistId)
    .select("*, playlist_tracks(count)")
    .single();
  if (error) throw new Error(`Unable to update playlist: ${error.message}`);
  return mapPlaylist(data);
}

export async function deletePlaylist(playlistId: string, client?: Client): Promise<void> {
  const { error } = await getClient(client)
    .from("playlists")
    .delete()
    .eq("id", playlistId);
  if (error) throw new Error(`Unable to delete playlist: ${error.message}`);
}

export async function duplicatePlaylist(
  playlistId: string,
  userId: string,
  newName?: string,
  client?: Client,
): Promise<Playlist> {
  const supabase = getClient(client);
  const source = await getPlaylistWithTracks(playlistId, supabase);
  if (!source) throw new Error("Source playlist not found");

  const newPlaylist = await createPlaylist(userId, newName ?? `${source.name} (Copy)`, source.description ?? undefined, supabase);

  if (source.tracks.length > 0) {
    const rows = source.tracks.map((track, index) => ({
      playlist_id: newPlaylist.id,
      track_id: track.id,
      position: index,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      duration: track.duration,
    }));
    const { error } = await supabase.from("playlist_tracks").insert(rows);
    if (error) throw new Error(`Unable to copy playlist tracks: ${error.message}`);
  }

  return newPlaylist;
}

// ── Playlist track management ─────────────────────────────────────────────────

/**
 * Add a track to a playlist. Stores title/artist/artwork/duration alongside
 * the track_id so the playlist detail page never needs to join the tracks table.
 */
export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
  meta: TrackMeta,
  position?: number,
  client?: Client,
): Promise<void> {
  const supabase = getClient(client);

  // If no position specified, append to end
  if (position === undefined) {
    const { data: existing, error: countError } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    if (countError) throw new Error(`Unable to determine playlist position: ${countError.message}`);
    position = existing.length > 0 ? existing[0].position + 1 : 0;
  }

  const { error } = await supabase
    .from("playlist_tracks")
    .upsert(
      { playlist_id: playlistId, track_id: trackId, position, ...meta },
      { onConflict: "playlist_id,track_id" },
    );
  if (error) throw new Error(`Unable to add track to playlist: ${error.message}`);
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
  client?: Client,
): Promise<void> {
  const { error } = await getClient(client)
    .from("playlist_tracks")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("track_id", trackId);
  if (error) throw new Error(`Unable to remove track from playlist: ${error.message}`);
}

/**
 * Reorder tracks by updating positions in-place (no delete+reinsert that would
 * lose denormalized metadata).
 */
export async function reorderPlaylistTracks(
  playlistId: string,
  trackIds: string[],
  client?: Client,
): Promise<void> {
  const supabase = getClient(client);

  // Update each track's position individually — avoids wiping metadata columns
  const updates = trackIds.map((trackId, index) =>
    supabase
      .from("playlist_tracks")
      .update({ position: index })
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId),
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw new Error(`Unable to reorder playlist: ${firstError.error.message}`);
}

// ── Playlist folders ──────────────────────────────────────────────────────────

export async function getUserFolders(userId: string, client?: Client): Promise<PlaylistFolder[]> {
  const { data, error } = await getClient(client)
    .from("playlist_folders")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Unable to load folders: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  }));
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
  const { error } = await getClient(client)
    .from("playlist_folders")
    .update(updates)
    .eq("id", folderId);
  if (error) throw new Error(`Unable to update folder: ${error.message}`);
}

export async function deleteFolder(folderId: string, client?: Client): Promise<void> {
  const { error } = await getClient(client)
    .from("playlist_folders")
    .delete()
    .eq("id", folderId);
  if (error) throw new Error(`Unable to delete folder: ${error.message}`);
}
