"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addTrackToPlaylist } from "@/lib/music/playlists";
import { showToast } from "@/stores/toast-store";
import type { Track } from "@/types/music";

interface AddTracksSheetProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  existingTrackIds: Set<string>;
  onTrackAdded: (track: Track) => void;
}

export function AddTracksSheet(props: AddTracksSheetProps) {
  if (!props.open || typeof document === "undefined") return null;

  return createPortal(
    <AddTracksContent {...props} />,
    document.body
  );
}

function AddTracksContent({
  onClose,
  playlistId,
  existingTrackIds,
  onTrackAdded,
}: AddTracksSheetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error("Search request failed");
        const data = await res.json();
        const tracks: Track[] = (data.tracks || data.items || []).map(
          (t: {
            id?: string;
            videoId?: string;
            title?: string;
            artist?: string;
            album?: string;
            artwork?: string;
            thumbnail?: string;
            duration?: number;
          }) => ({
            id: t.id || `youtube:${t.videoId || t.id}`,
            videoId: t.videoId || (t.id?.startsWith("youtube:") ? t.id.replace("youtube:", "") : t.id),
            title: t.title || "Untitled",
            artist: t.artist || "Unknown artist",
            album: t.album || "",
            artwork: t.artwork || t.thumbnail || "",
            duration: t.duration || 0,
          })
        );
        setResults(tracks);
      } catch (err) {
        console.error("[AddTracksSheet] Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  async function handleAdd(track: Track) {
    if (addingId || addedIds.has(track.id) || existingTrackIds.has(track.id)) return;
    setAddingId(track.id);

    try {
      await addTrackToPlaylist(playlistId, track.id, {
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
      });

      setAddedIds((prev) => new Set([...prev, track.id]));
      onTrackAdded(track);
      showToast(`Added "${track.title}" to playlist`);
    } catch (err) {
      console.error("[AddTracksSheet] Failed to add track:", err);
      showToast("Failed to add track to playlist");
    } finally {
      setAddingId(null);
    }
  }

  const displayResults = query.trim() ? results : [];

  return (
    <div className="mobile-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add songs to playlist">
      <div className="mobile-sheet-card mobile-sheet-card--full" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-drag-handle" aria-hidden="true" />

        {/* Top Header */}
        <div className="mobile-add-tracks__header">
          <h3>Add to this playlist</h3>
          <button type="button" className="mobile-add-tracks__close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="mobile-add-tracks__search-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="mobile-add-tracks__input"
            placeholder="Search songs or artists"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="mobile-add-tracks__clear-btn"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="mobile-add-tracks__results">
          {loading && (
            <div className="mobile-add-tracks__status">
              <span className="mobile-add-tracks__spinner" aria-hidden="true" />
              <span>Searching music…</span>
            </div>
          )}

          {!loading && query.trim() && displayResults.length === 0 && (
            <div className="mobile-add-tracks__status">
              <p>No tracks found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {!query.trim() && (
            <div className="mobile-add-tracks__hint">
              <p>Type above to search and add tracks to your playlist.</p>
            </div>
          )}

          {displayResults.map((track) => {
            const isAlreadyAdded = existingTrackIds.has(track.id) || addedIds.has(track.id);
            const isAdding = addingId === track.id;

            return (
              <div key={track.id} className="mobile-add-tracks__row">
                <div className="mobile-add-tracks__art">
                  {track.artwork ? (
                    <img src={track.artwork} alt="" width={44} height={44} />
                  ) : (
                    <div className="mobile-add-tracks__art-empty">♪</div>
                  )}
                </div>

                <div className="mobile-add-tracks__info">
                  <span className="mobile-add-tracks__title">{track.title}</span>
                  <span className="mobile-add-tracks__artist">{track.artist}</span>
                </div>

                <button
                  type="button"
                  className={`mobile-add-tracks__add-btn${isAlreadyAdded ? " mobile-add-tracks__add-btn--added" : ""}`}
                  onClick={() => void handleAdd(track)}
                  disabled={isAlreadyAdded || isAdding}
                  aria-label={isAlreadyAdded ? "Added to playlist" : "Add to playlist"}
                >
                  {isAlreadyAdded ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isAdding ? (
                    "…"
                  ) : (
                    "+"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
