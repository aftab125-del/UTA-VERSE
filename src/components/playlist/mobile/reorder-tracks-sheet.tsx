"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { reorderPlaylistTracks } from "@/lib/music/playlists";
import { showToast } from "@/stores/toast-store";
import type { Track } from "@/types/music";

interface ReorderTracksSheetProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  tracks: Track[];
  onOrderSaved: (newTracks: Track[]) => void;
  onRemoveTrack: (trackId: string) => void;
}

export function ReorderTracksSheet(props: ReorderTracksSheetProps) {
  if (!props.open || typeof document === "undefined") return null;

  return createPortal(
    <ReorderTracksContent {...props} />,
    document.body
  );
}

function ReorderTracksContent({
  onClose,
  playlistId,
  tracks: initialTracks,
  onOrderSaved,
  onRemoveTrack,
}: ReorderTracksSheetProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function moveTrack(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= tracks.length || fromIdx === toIdx) return;
    const next = [...tracks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setTracks(next);
  }

  function handleRemove(trackId: string) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    onRemoveTrack(trackId);
  }

  async function handleDone() {
    setSaving(true);
    try {
      const trackIds = tracks.map((t) => t.id);
      await reorderPlaylistTracks(playlistId, trackIds);
      onOrderSaved(tracks);
      showToast("Playlist order saved");
      onClose();
    } catch (err) {
      console.error("[ReorderTracksSheet] Failed to save order:", err);
      showToast("Failed to save playlist order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mobile-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit playlist tracks">
      <div className="mobile-sheet-card mobile-sheet-card--full" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="mobile-details__header">
          <button type="button" className="mobile-details__cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <h3 className="mobile-details__title">Edit playlist</h3>
          <button
            type="button"
            className="mobile-details__save-btn"
            onClick={() => void handleDone()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Done"}
          </button>
        </div>

        {/* Tracks List with Reorder buttons */}
        <div className="mobile-reorder__list">
          {tracks.length === 0 ? (
            <div className="mobile-reorder__empty">No tracks in this playlist.</div>
          ) : (
            tracks.map((track, idx) => (
              <div key={track.id} className="mobile-reorder__row">
                {/* Remove button */}
                <button
                  type="button"
                  className="mobile-reorder__remove-btn"
                  onClick={() => handleRemove(track.id)}
                  aria-label={`Remove ${track.title}`}
                  title="Remove from playlist"
                >
                  ⊖
                </button>

                {/* Track Artwork */}
                <div className="mobile-reorder__art">
                  {track.artwork ? (
                    <img src={track.artwork} alt="" width={40} height={40} />
                  ) : (
                    <div className="mobile-reorder__art-empty">♪</div>
                  )}
                </div>

                {/* Track details */}
                <div className="mobile-reorder__info">
                  <span className="mobile-reorder__title">{track.title}</span>
                  <span className="mobile-reorder__artist">{track.artist}</span>
                </div>

                {/* Move Controls */}
                <div className="mobile-reorder__arrows">
                  <button
                    type="button"
                    className="mobile-reorder__arrow-btn"
                    onClick={() => moveTrack(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="mobile-reorder__arrow-btn"
                    onClick={() => moveTrack(idx, idx + 1)}
                    disabled={idx === tracks.length - 1}
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
