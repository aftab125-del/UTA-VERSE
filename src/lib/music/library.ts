import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import type { LikedTrack, ListeningHistoryEntry, Track } from "@/types/music";

type Client = SupabaseClient<Database>;

function getClient(client?: Client): Client {
  return client ?? createSupabaseBrowserClient();
}

/** Subset of Track fields we denormalize into junction tables. */
interface TrackMeta {
  title: string;
  artist: string;
  artwork: string;
  duration: number;
}

// ── Liked tracks ──────────────────────────────────────────────────────────────

export async function getLikedTracks(userId: string, client?: Client): Promise<LikedTrack[]> {
  const { data, error } = await getClient(client)
    .from("liked_tracks")
    .select("track_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load liked tracks: ${error.message}`);
  return data.map((row) => ({ trackId: row.track_id, likedAt: row.created_at }));
}

export async function isTrackLiked(userId: string, trackId: string, client?: Client): Promise<boolean> {
  const { data, error } = await getClient(client)
    .from("liked_tracks")
    .select("track_id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (error) throw new Error(`Unable to check liked status: ${error.message}`);
  return data !== null;
}

/**
 * Toggle like status for a track. Returns the new liked state (true = liked, false = unliked).
 * Stores track metadata at write time so the Liked Songs page never needs to join the tracks table.
 */
export async function toggleLikeTrack(
  userId: string,
  trackId: string,
  meta: TrackMeta,
  client?: Client,
): Promise<boolean> {
  const supabase = getClient(client);
  const { data: existing, error: fetchError } = await supabase
    .from("liked_tracks")
    .select("track_id")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (fetchError) throw new Error(`Unable to check liked status: ${fetchError.message}`);

  if (existing) {
    const { error: deleteError } = await supabase
      .from("liked_tracks")
      .delete()
      .eq("user_id", userId)
      .eq("track_id", trackId);
    if (deleteError) throw new Error(`Unable to unlike track: ${deleteError.message}`);
    return false;
  }

  const { error: insertError } = await supabase
    .from("liked_tracks")
    .insert({
      user_id: userId,
      track_id: trackId,
      title: meta.title,
      artist: meta.artist,
      artwork: meta.artwork,
      duration: meta.duration,
    });
  if (insertError) throw new Error(`Unable to like track: ${insertError.message}`);
  return true;
}

/**
 * Bulk check which of the given track IDs are liked by the user.
 * Returns a Set of liked track IDs for efficient lookup.
 */
export async function getLikedTrackIds(userId: string, trackIds: string[], client?: Client): Promise<Set<string>> {
  if (trackIds.length === 0) return new Set();
  const { data, error } = await getClient(client)
    .from("liked_tracks")
    .select("track_id")
    .eq("user_id", userId)
    .in("track_id", trackIds);
  if (error) throw new Error(`Unable to load liked track IDs: ${error.message}`);
  return new Set(data.map((row) => row.track_id));
}

/**
 * Get full Track objects for all liked tracks — constructed entirely from
 * denormalized metadata stored in the liked_tracks row (no catalog join).
 */
export async function getLikedTracksWithDetails(userId: string, client?: Client, limit = 100): Promise<Track[]> {
  const { data: liked, error: likedError } = await getClient(client)
    .from("liked_tracks")
    .select("track_id, title, artist, artwork, duration")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (likedError) throw new Error(`Unable to load liked tracks: ${likedError.message}`);
  if (liked.length === 0) return [];

  return liked.map((row) => ({
    id: row.track_id,
    title: row.title || "Untitled",
    artist: row.artist || "Unknown artist",
    album: "",
    artwork: row.artwork,
    duration: row.duration,
  }));
}

// ── Listening history ─────────────────────────────────────────────────────────

/**
 * Record a listening event with denormalized track metadata.
 */
export async function recordListeningHistory(
  userId: string,
  trackId: string,
  meta: TrackMeta,
  progressMs = 0,
  client?: Client,
): Promise<void> {
  const { error } = await getClient(client)
    .from("listening_history")
    .insert({
      user_id: userId,
      track_id: trackId,
      progress_ms: progressMs,
      title: meta.title,
      artist: meta.artist,
      artwork: meta.artwork,
      duration: meta.duration,
    });
  if (error) throw new Error(`Unable to record listening history: ${error.message}`);
}

/**
 * Get recently played tracks (deduplicated by track_id, most recent first).
 */
export async function getRecentlyPlayed(userId: string, client?: Client, limit = 50): Promise<ListeningHistoryEntry[]> {
  const { data, error } = await getClient(client)
    .from("listening_history")
    .select("track_id, played_at, progress_ms")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit * 3); // fetch extra to account for dedup
  if (error) throw new Error(`Unable to load listening history: ${error.message}`);

  // Deduplicate by track_id, keeping the most recent entry
  const seen = new Set<string>();
  const deduped: ListeningHistoryEntry[] = [];
  for (const row of data) {
    if (!seen.has(row.track_id)) {
      seen.add(row.track_id);
      deduped.push({ trackId: row.track_id, playedAt: row.played_at, progressMs: row.progress_ms });
    }
    if (deduped.length >= limit) break;
  }
  return deduped;
}

/**
 * Get full Track objects for recently played tracks — constructed entirely
 * from denormalized metadata (no catalog join).
 */
export async function getRecentlyPlayedWithDetails(userId: string, client?: Client, limit = 50): Promise<Track[]> {
  const { data: history, error: historyError } = await getClient(client)
    .from("listening_history")
    .select("track_id, title, artist, artwork, duration, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit * 3);
  if (historyError) throw new Error(`Unable to load listening history: ${historyError.message}`);
  if (history.length === 0) return [];

  // Deduplicate by track_id, keeping the most recent entry
  const seen = new Set<string>();
  const deduped: Track[] = [];
  for (const row of history) {
    if (!seen.has(row.track_id)) {
      seen.add(row.track_id);
      deduped.push({
        id: row.track_id,
        title: row.title || "Untitled",
        artist: row.artist || "Unknown artist",
        album: "",
        artwork: row.artwork,
        duration: row.duration,
      });
    }
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export async function clearListeningHistory(userId: string, client?: Client): Promise<void> {
  const { error } = await getClient(client)
    .from("listening_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(`Unable to clear listening history: ${error.message}`);
}
