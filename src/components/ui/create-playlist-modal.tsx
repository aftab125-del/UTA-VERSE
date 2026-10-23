"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/hooks/use-user";
import { createPlaylist, updatePlaylist } from "@/lib/music/playlists";

interface CreatePlaylistModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (playlist: { id: string; name: string }) => void;
  initialName?: string;
  playlistId?: string;
  initialDescription?: string;
}

export function CreatePlaylistModal({
  open,
  onClose,
  onCreated,
  initialName,
  playlistId,
  initialDescription,
}: CreatePlaylistModalProps) {
  const { user } = useUser();
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    const effectiveUserId = user?.id ?? "local-user";

    try {
      if (playlistId) {
        const updated = await updatePlaylist(playlistId, {
          name: name.trim(),
          description: description.trim() || null,
        });
        onCreated({ id: updated.id, name: updated.name });
      } else {
        const created = await createPlaylist(effectiveUserId, name.trim(), description.trim() || undefined);
        onCreated({ id: created.id, name: created.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-label={playlistId ? "Edit playlist" : "Create playlist"}
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{playlistId ? "Edit playlist" : "Create playlist"}</h3>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
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
    </div>,
    document.body
  );
}
