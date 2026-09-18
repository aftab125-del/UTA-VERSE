"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { showToast } from "@/stores/toast-store";
import type { PlaylistWithTracks } from "@/types/music";

interface EditDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  playlist: PlaylistWithTracks;
  onUpdated: (updated: { name: string; description: string | null; coverUrl: string | null; isPublic: boolean }) => void;
  onDelete: () => void;
}

export function EditDetailsSheet(props: EditDetailsSheetProps) {
  if (!props.open || typeof document === "undefined") return null;

  return createPortal(
    <EditDetailsContent {...props} />,
    document.body
  );
}

function EditDetailsContent({
  onClose,
  playlist,
  onUpdated,
  onDelete,
}: EditDetailsSheetProps) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [coverUrl, setCoverUrl] = useState(playlist.coverUrl ?? "");
  const [isPublic, setIsPublic] = useState(playlist.isPublic ?? true);
  const [loading, setLoading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasChanged =
    name.trim() !== playlist.name ||
    description.trim() !== (playlist.description ?? "") ||
    coverUrl !== (playlist.coverUrl ?? "") ||
    isPublic !== (playlist.isPublic ?? true);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file");
      return;
    }

    // Limit to 4MB
    if (file.size > 4 * 1024 * 1024) {
      showToast("Image must be under 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverUrl(reader.result);
        showToast("Cover image selected");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const updates = {
        name: name.trim(),
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
        is_public: isPublic,
      };

      const { error } = await supabase
        .from("playlists")
        .update(updates)
        .eq("id", playlist.id);

      if (error) throw error;

      onUpdated({
        name: updates.name,
        description: updates.description,
        coverUrl: updates.cover_url,
        isPublic: updates.is_public,
      });
      showToast("Playlist details saved");
      onClose();
    } catch (err) {
      console.error("[EditDetailsSheet] Failed to update playlist:", err);
      showToast(err instanceof Error ? err.message : "Failed to save playlist");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mobile-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Name and details">
      <div className="mobile-sheet-card mobile-sheet-card--full" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="mobile-details__header">
          <button type="button" className="mobile-details__cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <h3 className="mobile-details__title">Name & details</h3>
          <button
            type="button"
            className="mobile-details__save-btn"
            onClick={() => void handleSave()}
            disabled={loading || !name.trim() || !hasChanged}
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="mobile-details__body">
          {/* Cover Art with Pencil Overlay */}
          <div className="mobile-details__art-section">
            <div className="mobile-details__art-wrap">
              {coverUrl ? (
                <img src={coverUrl} alt="Playlist cover" className="mobile-details__cover-img" />
              ) : (
                <div className="mobile-details__empty-art">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}

              {/* Circular Pencil Button */}
              <button
                type="button"
                className="mobile-details__pencil-btn"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                aria-label="Change playlist cover image"
                title="Change cover photo"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={handleFileChange}
              />
            </div>

            <button
              type="button"
              className="mobile-details__url-toggle"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              {showUrlInput ? "Hide image URL" : "Or use image URL"}
            </button>

            {showUrlInput && (
              <div className="mobile-details__url-row">
                <input
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="mobile-details__input"
                />
                <button
                  type="button"
                  className="mobile-details__url-apply-btn"
                  onClick={() => {
                    if (customUrl.trim()) {
                      setCoverUrl(customUrl.trim());
                      setShowUrlInput(false);
                      showToast("Cover URL applied");
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="mobile-details__field">
            <label className="visually-hidden" htmlFor="playlist-name-input">Playlist name</label>
            <input
              id="playlist-name-input"
              type="text"
              className="mobile-details__input mobile-details__input--name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playlist name"
              required
            />
          </div>

          {/* Description Textarea */}
          <div className="mobile-details__field">
            <label className="visually-hidden" htmlFor="playlist-desc-input">Playlist description</label>
            <textarea
              id="playlist-desc-input"
              className="mobile-details__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
            />
          </div>

          {/* Action Rows */}
          <div className="mobile-details__actions-list">
            {/* Make Private / Public Toggle */}
            <button
              type="button"
              className="mobile-details__action-row"
              onClick={() => setIsPublic(!isPublic)}
            >
              <div className="mobile-details__action-icon">
                {isPublic ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
              <div className="mobile-details__action-text">
                <span>{isPublic ? "Make private" : "Make public"}</span>
                <small>{isPublic ? "Currently visible to everyone" : "Only visible to you"}</small>
              </div>
            </button>

            {/* Delete Playlist Action */}
            <button
              type="button"
              className="mobile-details__action-row mobile-details__action-row--danger"
              onClick={onDelete}
            >
              <div className="mobile-details__action-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div className="mobile-details__action-text">
                <span>Delete playlist</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
