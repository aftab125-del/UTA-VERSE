"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrackActions } from "@/components/ui/track-actions";

export function QueuePanel() {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const setTrack = usePlayerStore((s) => s.setTrack);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Expose toggle via a global so the dock button can use it.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__queuePanelToggle = () => setOpen((v) => !v);
    return () => {
      delete (w as Record<string, unknown>).__queuePanelToggle;
    };
  }, []);

  function handleDragStart(index: number, e: React.DragEvent) {
    dragIndexRef.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(index: number) {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      reorderQueue(dragIndexRef.current, index);
    }
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
  }

  function playTrackFromQueue(index: number) {
    const track = queue[index];
    if (track) void setTrack(track, queue);
  }

  if (!open) return null;

  const upcoming = queue.slice(queueIndex + 1);

  return (
    <div className="queue-overlay" role="dialog" aria-label="Playback queue">
      <div className="queue-panel" ref={panelRef}>
        <div className="queue-panel__header">
          <div className="queue-panel__header-info">
            <h2>Queue</h2>
            <span className="queue-panel__count">
              {queue.length} {queue.length === 1 ? "track" : "tracks"}
            </span>
          </div>
          <div className="queue-panel__actions">
            {upcoming.length > 0 && (
              <button
                type="button"
                className="queue-panel__clear"
                onClick={() => setConfirmClear(true)}
                title="Clear upcoming tracks"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="queue-panel__close"
              onClick={() => setOpen(false)}
              aria-label="Close queue"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="queue-panel__empty">
            <div className="queue-panel__empty-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <p>Your queue is empty</p>
            <span>Add tracks from search, playlists, or albums.</span>
          </div>
        ) : (
          <div className="queue-panel__sections">
            {/* Now playing */}
            {currentTrack && (
              <div className="queue-panel__section">
                <div className="queue-panel__section-header">
                  <span className="queue-panel__section-label">Now Playing</span>
                </div>
                <div className="queue-item queue-item--current">
                  <div className="queue-item__leading" aria-hidden="true">
                    <span className={`queue-item__now-indicator${isPlaying ? "" : " queue-item__now-indicator--paused"}`}>
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                  <div className="queue-item__artwork-col">
                    <ArtworkTile artwork={currentTrack.artwork} title={currentTrack.title} size="small" />
                  </div>
                  <div className="queue-item__details">
                    <strong title={currentTrack.title}>{currentTrack.title}</strong>
                    <span title={currentTrack.artist}>{currentTrack.artist}</span>
                  </div>
                  <span className="queue-item__duration">{formatDuration(currentTrack.duration)}</span>
                  <div className="queue-item__actions" onClick={(e) => e.stopPropagation()}>
                    <TrackActions track={currentTrack} size="small" variant="dropdown" />
                  </div>
                </div>
              </div>
            )}

            {/* Next up */}
            {upcoming.length > 0 && (
              <div className="queue-panel__section">
                <div className="queue-panel__section-header">
                  <span className="queue-panel__section-label">Next Up</span>
                  <span className="queue-panel__section-sublabel">{upcoming.length}</span>
                </div>
                <div className="queue-panel__list">
                  {upcoming.map((track, i) => {
                    const realIndex = queueIndex + 1 + i;
                    const isDragging = draggingIndex === realIndex;
                    const isDragOver = dragOverIndex === realIndex;

                    return (
                      <div
                        key={`${track.id}-${realIndex}`}
                        className={`queue-item${isDragging ? " queue-item--dragging" : ""}${isDragOver ? " queue-item--drag-over" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(realIndex, e)}
                        onDragOver={(e) => handleDragOver(realIndex, e)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(realIndex)}
                        onDragEnd={handleDragEnd}
                      >
                        <div
                          className="queue-item__leading queue-item__grip"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="5" r="1.8" />
                            <circle cx="15" cy="5" r="1.8" />
                            <circle cx="9" cy="12" r="1.8" />
                            <circle cx="15" cy="12" r="1.8" />
                            <circle cx="9" cy="19" r="1.8" />
                            <circle cx="15" cy="19" r="1.8" />
                          </svg>
                        </div>

                        <div
                          className="queue-item__artwork-col"
                          onClick={() => playTrackFromQueue(realIndex)}
                          role="button"
                          tabIndex={0}
                          title={`Play ${track.title}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              playTrackFromQueue(realIndex);
                            }
                          }}
                        >
                          <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
                          <div className="queue-item__artwork-play" aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="6 3 20 12 6 21 6 3" />
                            </svg>
                          </div>
                        </div>

                        <div
                          className="queue-item__details"
                          onClick={() => playTrackFromQueue(realIndex)}
                          role="button"
                          tabIndex={0}
                          title={`Play ${track.title}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              playTrackFromQueue(realIndex);
                            }
                          }}
                        >
                          <strong title={track.title}>{track.title}</strong>
                          <span title={track.artist}>{track.artist}</span>
                        </div>

                        <span className="queue-item__duration">{formatDuration(track.duration)}</span>

                        <div className="queue-item__actions" onClick={(e) => e.stopPropagation()}>
                          <TrackActions
                            track={track}
                            size="small"
                            variant="dropdown"
                            onRemoveFromQueue={() => removeFromQueue(realIndex)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear queue"
        message="Are you sure you want to clear upcoming tracks in the queue? The currently playing track will continue."
        confirmLabel="Clear"
        danger
        onConfirm={() => {
          clearQueue();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
