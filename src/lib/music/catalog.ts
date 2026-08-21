import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import type { Album, Artist, Track } from "@/types/music";

type Client = SupabaseClient<Database>;

type TrackWithRelations = Database["public"]["Tables"]["tracks"]["Row"] & {
  artists: { name: string } | null;
  albums: { title: string; artwork_url: string | null } | null;
};

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

function mapAlbum(row: Database["public"]["Tables"]["albums"]["Row"] & { artists: { name: string } | null; tracks: { count: number }[] }): Album {
  return { id: row.id, title: row.title, artist: row.artists?.name ?? "Unknown artist", artwork: row.artwork_url ?? "", trackCount: row.tracks[0]?.count ?? 0 };
}

function mapArtist(row: Database["public"]["Tables"]["artists"]["Row"]): Artist {
  return { id: row.id, name: row.name, artwork: row.image_url ?? "", genre: "" };
}

export async function getTracks(client?: Client): Promise<Track[]> {
  const { data, error } = await getClient(client).from("tracks").select("*, artists(name), albums(title, artwork_url)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load tracks: ${error.message}`);
  return (data as unknown as TrackWithRelations[]).map(mapTrack);
}

export async function getTrackById(id: string, client?: Client): Promise<Track | null> {
  const { data, error } = await getClient(client).from("tracks").select("*, artists(name), albums(title, artwork_url)").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load track: ${error.message}`);
  return data ? mapTrack(data as unknown as TrackWithRelations) : null;
}

export async function getAlbums(client?: Client): Promise<Album[]> {
  const { data, error } = await getClient(client).from("albums").select("*, artists(name), tracks(count)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load albums: ${error.message}`);
  return (data as unknown as (Database["public"]["Tables"]["albums"]["Row"] & { artists: { name: string } | null; tracks: { count: number }[] })[]).map(mapAlbum);
}

export async function getAlbumById(id: string, client?: Client): Promise<Album | null> {
  const { data, error } = await getClient(client).from("albums").select("*, artists(name), tracks(count)").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load album: ${error.message}`);
  return data ? mapAlbum(data as unknown as Database["public"]["Tables"]["albums"]["Row"] & { artists: { name: string } | null; tracks: { count: number }[] }) : null;
}

export async function getArtists(client?: Client): Promise<Artist[]> {
  const { data, error } = await getClient(client).from("artists").select("*").order("name");
  if (error) throw new Error(`Unable to load artists: ${error.message}`);
  return data.map(mapArtist);
}

export async function getArtistById(id: string, client?: Client): Promise<Artist | null> {
  const { data, error } = await getClient(client).from("artists").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load artist: ${error.message}`);
  return data ? mapArtist(data) : null;
}
