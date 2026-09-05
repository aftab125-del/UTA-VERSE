export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      artists: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          image_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          image_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      albums: {
        Row: {
          id: string;
          title: string;
          artist_id: string;
          artwork_url: string | null;
          release_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist_id: string;
          artwork_url?: string | null;
          release_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist_id?: string;
          artwork_url?: string | null;
          release_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "albums_artist_id_fkey"; columns: ["artist_id"]; isOneToOne: false; referencedRelation: "artists"; referencedColumns: ["id"] },
        ];
      };
      tracks: {
        Row: {
          id: string;
          title: string;
          artist_id: string;
          album_id: string | null;
          artwork_url: string | null;
          audio_url: string | null;
          duration: number;
          track_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist_id: string;
          album_id?: string | null;
          artwork_url?: string | null;
          audio_url?: string | null;
          duration: number;
          track_number?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist_id?: string;
          album_id?: string | null;
          artwork_url?: string | null;
          audio_url?: string | null;
          duration?: number;
          track_number?: number | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "tracks_artist_id_fkey"; columns: ["artist_id"]; isOneToOne: false; referencedRelation: "artists"; referencedColumns: ["id"] },
          { foreignKeyName: "tracks_album_id_fkey"; columns: ["album_id"]; isOneToOne: false; referencedRelation: "albums"; referencedColumns: ["id"] },
        ];
      };
      playlists: {
        Row: { id: string; user_id: string; name: string; description: string | null; cover_url: string | null; folder_id: string | null; is_public: boolean; created_at: string };
        Insert: { id?: string; user_id: string; name: string; description?: string | null; cover_url?: string | null; folder_id?: string | null; is_public?: boolean; created_at?: string };
        Update: { id?: string; user_id?: string; name?: string; description?: string | null; cover_url?: string | null; folder_id?: string | null; is_public?: boolean; created_at?: string };
        Relationships: [
          { foreignKeyName: "playlists_folder_id_fkey"; columns: ["folder_id"]; isOneToOne: false; referencedRelation: "playlist_folders"; referencedColumns: ["id"] },
        ];
      };
      playlist_tracks: {
        Row: { playlist_id: string; track_id: string; position: number; title: string; artist: string; artwork: string; duration: number };
        Insert: { playlist_id: string; track_id: string; position: number; title?: string; artist?: string; artwork?: string; duration?: number };
        Update: { playlist_id?: string; track_id?: string; position?: number; title?: string; artist?: string; artwork?: string; duration?: number };
        Relationships: [
          { foreignKeyName: "playlist_tracks_playlist_id_fkey"; columns: ["playlist_id"]; isOneToOne: false; referencedRelation: "playlists"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; created_at: string };
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; created_at?: string };
        Update: { id?: string; display_name?: string | null; avatar_url?: string | null; created_at?: string };
        Relationships: [];
      };
      liked_tracks: {
        Row: { user_id: string; track_id: string; created_at: string; title: string; artist: string; artwork: string; duration: number };
        Insert: { user_id: string; track_id: string; created_at?: string; title?: string; artist?: string; artwork?: string; duration?: number };
        Update: { user_id?: string; track_id?: string; created_at?: string; title?: string; artist?: string; artwork?: string; duration?: number };
        Relationships: [];
      };
      listening_history: {
        Row: { id: string; user_id: string; track_id: string; played_at: string; progress_ms: number; title: string; artist: string; artwork: string; duration: number };
        Insert: { id?: string; user_id: string; track_id: string; played_at?: string; progress_ms?: number; title?: string; artist?: string; artwork?: string; duration?: number };
        Update: { id?: string; user_id?: string; track_id?: string; played_at?: string; progress_ms?: number; title?: string; artist?: string; artwork?: string; duration?: number };
        Relationships: [];
      };
      playlist_folders: {
        Row: { id: string; user_id: string; name: string; position: number; created_at: string };
        Insert: { id?: string; user_id: string; name: string; position?: number; created_at?: string };
        Update: { id?: string; user_id?: string; name?: string; position?: number; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
