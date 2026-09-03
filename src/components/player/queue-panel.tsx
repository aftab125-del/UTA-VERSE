"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { ArtworkTile } from "@/components/music/artwork-tile";

export function QueuePanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
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
    return () => { delete (w as Record<string, unknown>).__queuePanelToggle; };
  }, []);

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(index: number) {
    if (dragIndex.current !== null && dragIndex.current !== index) {
      reorderQueue(dragIndex.current, index);
    }
    dragIndex.current = null;
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
          <h2>Queue</h2>
          <div className="queue-panel__actions">
            {queue.length > 1 && (
              <button type="button" className="queue-panel__clear" onClick={clearQueue}>
                Clear
              </button>
            )}
            <button type="button" className="queue-panel__close" onClick={() => setOpen(false)} aria-label="Close queue">
              ✕
            </button>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="queue-panel__empty">
            <p>Your queue is empty.</p>
            <span>Add tracks from anywhere in the app.</span>
          </div>
        ) : (
          <div className="queue-panel__sections">
            {/* Now playing */}
            {currentTrack && (
              <div className="queue-panel__section">
                <p className="queue-panel__section-label">Now Playing</p>
                <div className="queue-item queue-item--current">
                  <ArtworkTile artwork={currentTrack.artwork} title={currentTrack.title} size="small" />
                  <div className="queue-item__details">
                    <strong>{currentTrack.title}</strong>
                    <span>{currentTrack.artist}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Next up */}
            {upcoming.length > 0 && (
              <div className="queue-panel__section">
                <p className="queue-panel__section-label">Next Up</p>
                <div className="queue-panel__list">
                  {upcoming.map((track, i) => {
                    const realIndex = queueIndex + 1 + i;
                    return (
                      <div
                        key={`${track.id}-${realIndex}`}
                        className="queue-item"
                        draggable
                        onDragStart={() => handleDragStart(realIndex)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(realIndex)}
                      >
                        <span className="queue-item__grip" aria-hidden="true">⠿</span>
                        <button
                          type="button"
                          className="queue-item__play"
                          onClick={() => playTrackFromQueue(realIndex)}
                          aria-label={`Play ${track.title}`}
                        >
                          ▶
                        </button>
                        <ArtworkTile artwork={track.artwork} title={track.title} size="small" />
                        <div className="queue-item__details">
                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>
                        </div>
                        <button
                          type="button"
                          className="queue-item__remove"
                          onClick={() => removeFromQueue(realIndex)}
                          aria-label={`Remove ${track.title} from queue`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
