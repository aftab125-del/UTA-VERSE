"use client";

import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";

export function PlayerDock() {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const position = usePlayerStore((state) => state.position);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const queue = usePlayerStore((state) => state.queue);
  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);

  const hasTrack = Boolean(currentTrack);

  return (
    <footer className="player-dock" aria-label="Music player">
      <div className="player-dock__track">
        {currentTrack ? <ArtworkTile artwork={currentTrack.artwork} title={currentTrack.title} size="small" /> : <div className="player-dock__empty-art" aria-hidden="true" />}
        <div className="player-dock__metadata">
          <strong>{currentTrack?.title ?? "Choose something to play"}</strong>
          <span>{currentTrack?.artist ?? "Your player is ready"}</span>
        </div>
      </div>

      <div className="player-dock__transport">
        <div className="player-dock__buttons">
          <button type="button" className="icon-button" onClick={previous} disabled={!hasTrack} aria-label="Previous track">◀◀</button>
          <button type="button" className="player-dock__play-button" onClick={() => void togglePlayPause()} disabled={!hasTrack} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
          <button type="button" className="icon-button" onClick={next} disabled={!hasTrack} aria-label="Next track">▶▶</button>
        </div>
        <div className="player-dock__progress-row">
          <span>{formatTime(position)}</span>
          <input type="range" min="0" max={duration || 1} value={Math.min(position, duration || 1)} onChange={(event) => seek(Number(event.target.value))} disabled={!hasTrack} aria-label="Track progress" />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-dock__tools">
        <button type="button" className="icon-button" onClick={toggleMute} disabled={!hasTrack} aria-label={isMuted ? "Unmute" : "Mute"}>{isMuted ? "×" : "◖"}</button>
        <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={!hasTrack} aria-label="Volume" />
        <button type="button" className="queue-button" disabled={!hasTrack} aria-label={`Open queue, ${queue.length} tracks`}>Queue <span>{queue.length}</span></button>
      </div>
    </footer>
  );
}

function formatTime(seconds: number) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
