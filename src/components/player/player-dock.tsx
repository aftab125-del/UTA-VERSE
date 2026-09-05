"use client";

import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";
import { QueuePanel } from "@/components/player/queue-panel";
import { LikeButton } from "@/components/ui/track-actions";

export function PlayerDock() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const queue = usePlayerStore((state) => state.queue);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const isShuffled = usePlayerStore((state) => state.isShuffled);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const setRepeatMode = usePlayerStore((state) => state.setRepeatMode);
  const setShuffled = usePlayerStore((state) => state.setShuffled);
  const error = usePlayerStore((state) => state.error);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const isResolving = usePlayerStore((state) => state.isResolving);

  const hasTrack = Boolean(currentTrack);

  function cycleRepeat() {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }

  function openQueue() {
    const toggle = (window as unknown as Record<string, unknown>).__queuePanelToggle as (() => void) | undefined;
    toggle?.();
  }

  return (
    <>
      <footer className="player-dock" aria-label="Music player">
        <div className="player-dock__track">
          {currentTrack ? <ArtworkTile artwork={currentTrack.artwork} title={currentTrack.title} size="small" /> : <div className="player-dock__empty-art" aria-hidden="true" />}
          <div className="player-dock__metadata">
            <strong>{currentTrack?.title ?? "Choose something to play"}</strong>
            <span className={error ? "player-dock__error" : undefined}>{error ?? (isResolving ? "Resolving audio source…" : isLoading ? "Loading audio…" : currentTrack?.artist ?? "Your player is ready")}</span>
          </div>
          {currentTrack && <LikeButton track={currentTrack} size="small" />}
        </div>

        <div className="player-dock__transport">
          <div className="player-dock__buttons">
            <button type="button" className={`icon-button${isShuffled ? " icon-button--active" : ""}`} onClick={() => setShuffled(!isShuffled)} disabled={!hasTrack} aria-label={isShuffled ? "Disable shuffle" : "Enable shuffle"}>
              ⇄
            </button>
            <button type="button" className="icon-button" onClick={previous} disabled={!hasTrack} aria-label="Previous track">
              ◀◀
            </button>
            <button type="button" className="player-dock__play-button" onClick={() => void togglePlayPause()} disabled={!hasTrack || isResolving || isLoading} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button type="button" className="icon-button" onClick={next} disabled={!hasTrack} aria-label="Next track">
              ▶▶
            </button>
            <button type="button" className={`icon-button${repeatMode !== "off" ? " icon-button--active" : ""}`} onClick={cycleRepeat} disabled={!hasTrack} aria-label={`Repeat: ${repeatMode}`}>
              {repeatMode === "one" ? "↻₁" : "↻"}
            </button>
          </div>
          <div className="player-dock__progress-row">
            <span>{formatTime(position)}</span>
            <input type="range" min="0" max={duration || 1} value={Math.min(position, duration || 1)} onChange={(event) => seek(Number(event.target.value))} disabled={!hasTrack || isResolving || isLoading || duration <= 0} aria-label="Track progress" />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-dock__tools">
          <button type="button" className="icon-button" onClick={toggleMute} disabled={!hasTrack} aria-label={isMuted ? "Unmute" : "Mute"}>{isMuted ? "×" : "◖"}</button>
          <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={!hasTrack} aria-label="Volume" />
          <button type="button" className="queue-button" disabled={!hasTrack} onClick={openQueue} aria-label={`Open queue, ${queue.length} tracks`}>Queue <span>{queue.length}</span></button>
        </div>
      </footer>
      <QueuePanel />
    </>
  );
}

function formatTime(seconds: number) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
