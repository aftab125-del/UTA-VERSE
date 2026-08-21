import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database, Tables } from "@/types/database";
import type { Album, Artist, Track } from "@/types/music";

type Client = SupabaseClient<Database>;
type TrackRow = Tables<"tracks">;
type AlbumRow = Tables<"albums">;

type TrackWithRelations = TrackRow & {
  artists: { name: string } | null;
  albums: { title: string; artwork_url: string | null } | null;
};

type AlbumWithRelations = AlbumRow & {
  artists: { name: string } | null;
  tracks: { count: number }[];
};

export interface ArtistPageData {
  artist: Artist;
  tracks: Track[];
  albums: Album[];
}

export interface AlbumPageData {
  album: Album;
  tracks: Track[];
}

export interface CatalogSearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

function getClient(client?: Client): Client {
  return client ?? createSupabaseBrowserClient();
}

function mapTrack(row: TrackWithRelations): Track {
  return {
    id: row.id,
    title: row.title,
    artist: row.artists?.name ?? "Unknown artist",
    album: row.albums?.title ?? "Unknown album",
    artwork: row.artwork_url ?? row.albums?.artwork_url ?? "",
    duration: row.duration,
    ...(row.audio_url ? { audioUrl: row.audio_url } : {}),
  };
}

function mapAlbum(row: AlbumWithRelations): Album {
  return {
    id: row.id,
    title: row.title,
    artist: row.artists?.name ?? "Unknown artist",
    artwork: row.artwork_url ?? "",
    trackCount: row.tracks[0]?.count ?? 0,
  };
}

function mapArtist(row: Tables<"artists">): Artist {
  return { id: row.id, name: row.name, artwork: row.image_url ?? "", genre: "", ...(row.bio ? { bio: row.bio } : {}) };
}

async function getTracksByFilter(
  filter: (query: ReturnType<Client["from"]>) => ReturnType<Client["from"]>,
  client?: Client,
  limit = 50,
): Promise<Track[]> {
  const baseQuery = getClient(client)
    .from("tracks")
    .select("*, artists(name), albums(title, artwork_url)")
    .order("track_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data, error } = await filter(baseQuery);
  if (error) throw new Error(`Unable to load tracks: ${error.message}`);
  return (data as unknown as TrackWithRelations[]).map(mapTrack);
}

export async function getTracks(client?: Client, limit = 50): Promise<Track[]> {
  return getTracksByFilter((query) => query, client, limit);
}

export async function getTracksByArtistId(id: string, client?: Client, limit = 50): Promise<Track[]> {
  return getTracksByFilter((query) => query.eq("artist_id", id), client, limit);
}

export async function getTracksByAlbumId(id: string, client?: Client, limit = 50): Promise<Track[]> {
  return getTracksByFilter((query) => query.eq("album_id", id), client, limit);
}

export async function getTrackById(id: string, client?: Client): Promise<Track | null> {
  const { data, error } = await getClient(client)
    .from("tracks")
    .select("*, artists(name), albums(title, artwork_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load track: ${error.message}`);
  return data ? mapTrack(data as unknown as TrackWithRelations) : null;
}

export async function getAlbums(client?: Client, limit = 50): Promise<Album[]> {
  const { data, error } = await getClient(client)
    .from("albums")
    .select("*, artists(name), tracks(count)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Unable to load albums: ${error.message}`);
  return (data as unknown as AlbumWithRelations[]).map(mapAlbum);
}

export async function getAlbumsByArtistId(id: string, client?: Client, limit = 50): Promise<Album[]> {
  const { data, error } = await getClient(client)
    .from("albums")
    .select("*, artists(name), tracks(count)")
    .eq("artist_id", id)
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Unable to load albums: ${error.message}`);
  return (data as unknown as AlbumWithRelations[]).map(mapAlbum);
}

export async function getAlbumById(id: string, client?: Client): Promise<Album | null> {
  const { data, error } = await getClient(client)
    .from("albums")
    .select("*, artists(name), tracks(count)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Unable to load album: ${error.message}`);
  return data ? mapAlbum(data as unknown as AlbumWithRelations) : null;
}

export async function getArtists(client?: Client, limit = 50): Promise<Artist[]> {
  const { data, error } = await getClient(client).from("artists").select("*").order("name").limit(limit);
  if (error) throw new Error(`Unable to load artists: ${error.message}`);
  return data.map(mapArtist);
}

export async function getArtistById(id: string, client?: Client): Promise<Artist | null> {
  const { data, error } = await getClient(client).from("artists").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load artist: ${error.message}`);
  return data ? mapArtist(data) : null;
}

export async function getArtistPageData(id: string, client?: Client): Promise<ArtistPageData | null> {
  const supabase = getClient(client);
  const [artist, tracks, albums] = await Promise.all([
    getArtistById(id, supabase),
    getTracksByArtistId(id, supabase),
    getAlbumsByArtistId(id, supabase),
  ]);
  return artist ? { artist, tracks, albums } : null;
}

export async function getAlbumPageData(id: string, client?: Client): Promise<AlbumPageData | null> {
  const supabase = getClient(client);
  const [album, tracks] = await Promise.all([
    getAlbumById(id, supabase),
    getTracksByAlbumId(id, supabase),
  ]);
  return album ? { album, tracks } : null;
}

export async function searchCatalog(query: string, client?: Client, limit = 20): Promise<CatalogSearchResults> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return { tracks: [], albums: [], artists: [] };

  const supabase = getClient(client);
  const pattern = `%${normalizedQuery}%`;
  const [trackRows, albumRows, artistRows] = await Promise.all([
    supabase.from("tracks").select("*, artists(name), albums(title, artwork_url)").ilike("title", pattern).limit(limit),
    supabase.from("albums").select("*, artists(name), tracks(count)").ilike("title", pattern).limit(limit),
    supabase.from("artists").select("*").ilike("name", pattern).limit(limit),
  ]);

  if (trackRows.error) throw new Error(`Unable to search tracks: ${trackRows.error.message}`);
  if (albumRows.error) throw new Error(`Unable to search albums: ${albumRows.error.message}`);
  if (artistRows.error) throw new Error(`Unable to search artists: ${artistRows.error.message}`);

  const albums = (albumRows.data as unknown as AlbumWithRelations[]).map(mapAlbum);
  const artists = artistRows.data.map(mapArtist);
  const directTracks = (trackRows.data as unknown as TrackWithRelations[]).map(mapTrack);
  const relatedArtistIds = artists.map((artist) => artist.id);
  const relatedAlbumIds = albums.map((album) => album.id);

  let relatedTracks: Track[] = [];
  if (relatedArtistIds.length || relatedAlbumIds.length) {
    const filters = [
      relatedArtistIds.length ? `artist_id.in.(${relatedArtistIds.join(",")})` : "",
      relatedAlbumIds.length ? `album_id.in.(${relatedAlbumIds.join(",")})` : "",
    ].filter(Boolean).join(",");
    const result = await supabase.from("tracks").select("*, artists(name), albums(title, artwork_url)").or(filters).limit(limit);
    if (result.error) throw new Error(`Unable to search related tracks: ${result.error.message}`);
    relatedTracks = (result.data as unknown as TrackWithRelations[]).map(mapTrack);
  }

  const tracks = [...directTracks, ...relatedTracks].filter((track, index, all) => all.findIndex((item) => item.id === track.id) === index).slice(0, limit);
  return { tracks, albums, artists };
}
