"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/app/library/components/use-library";

interface CreatePlaylistModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (playlist: { id: string; name: string }) => void;
  initialName?: string;
  playlistId?: string;
  initialDescription?: string;
}

export function CreatePlaylistModal({ open, onClose, onCreated, initialName, playlistId, initialDescription }: CreatePlaylistModalProps) {
  const { user } = useUser();
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (playlistId) {
        const { error: updateError } = await supabase
          .from("playlists")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", playlistId);
        if (updateError) throw updateError;
        onCreated({ id: playlistId, name: name.trim() });
      } else {
        const { data, error: insertError } = await supabase
          .from("playlists")
          .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null })
          .select("id, name")
          .single();
        if (insertError) throw insertError;
        onCreated(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-label={playlistId ? "Edit playlist" : "Create playlist"} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{playlistId ? "Edit playlist" : "Create playlist"}</h3>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form className="modal-card__body" onSubmit={(e) => void handleSubmit(e)}>
          {error && <div className="auth-error">{error}</div>}
          <label className="auth-field">
            <span>Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My playlist"
              autoFocus
            />
          </label>
          <label className="auth-field">
            <span>Description (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional description"
            />
          </label>
          <button type="submit" className="auth-submit" disabled={loading || !name.trim()}>
            {loading ? "Saving…" : playlistId ? "Save changes" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
