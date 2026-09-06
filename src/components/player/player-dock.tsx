"use client";

import { useEffect, useRef, useState } from "react";
import { ArtworkTile } from "@/components/music/artwork-tile";
import { usePlayerStore } from "@/stores/player-store";
import { QueuePanel } from "@/components/player/queue-panel";
import { LikeButton, AddToPlaylistButton, AddToQueueButton } from "@/components/ui/track-actions";
import { GlassSurface } from "@/components/reactbits/GlassSurface";

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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasTrack = Boolean(currentTrack);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  function cycleRepeat() {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }

  function openQueue() {
    setMenuOpen(false);
    const toggle = (window as unknown as Record<string, unknown>).__queuePanelToggle as (() => void) | undefined;
    toggle?.();
  }

  return (
    <>
      <footer className="player-dock" aria-label="Music player">
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={24}
          backgroundOpacity={0.15}
          saturation={1.8}
          displace={0.5}
          blur={16}
          distortionScale={-180}
          className="player-dock__glass"
        >
          <div className="player-dock__inner">
            {/* Left: Track metadata & Like button */}
            <div className="player-dock__track">
              {currentTrack ? (
                <ArtworkTile artwork={currentTrack.artwork} title={currentTrack.title} size="small" />
              ) : (
                <div className="player-dock__empty-art" aria-hidden="true" />
              )}
              <div className="player-dock__metadata">
                <strong title={currentTrack?.title ?? "Choose something to play"}>
                  {currentTrack?.title ?? "Choose something to play"}
                </strong>
                <span
                  className={error ? "player-dock__error" : undefined}
                  title={error ?? (isResolving ? "Resolving audio source…" : isLoading ? "Loading audio…" : currentTrack?.artist ?? "Ready")}
                >
                  {error ?? (isResolving ? "Resolving audio source…" : isLoading ? "Loading audio…" : currentTrack?.artist ?? "Ready")}
                </span>
              </div>
              {currentTrack && <LikeButton track={currentTrack} size="small" />}
            </div>

            {/* Center: Transport & Horizontal Seek Timeline */}
            <div className="player-dock__center">
              <div className="player-dock__transport">
                <button
                  type="button"
                  className="icon-button player-dock__btn-prev"
                  onClick={previous}
                  disabled={!hasTrack}
                  aria-label="Previous track"
                >
                  ◀◀
                </button>
                <button
                  type="button"
                  className="player-dock__play-button"
                  onClick={() => void togglePlayPause()}
                  disabled={!hasTrack || isResolving || isLoading}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? "Ⅱ" : "▶"}
                </button>
                <button
                  type="button"
                  className="icon-button player-dock__btn-next"
                  onClick={next}
                  disabled={!hasTrack}
                  aria-label="Next track"
                >
                  ▶▶
                </button>
              </div>
              <div className="player-dock__timeline">
                <span className="player-dock__time">{formatTime(position)}</span>
                <input
                  type="range"
                  className="player-dock__slider"
                  min="0"
                  max={duration || 1}
                  value={Math.min(position, duration || 1)}
                  onChange={(event) => seek(Number(event.target.value))}
                  disabled={!hasTrack || isResolving || isLoading || duration <= 0}
                  aria-label="Track progress"
                />
                <span className="player-dock__time">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: Volume & More Options */}
            <div className="player-dock__tools" ref={menuRef}>
              <div className="player-dock__volume">
                <button
                  type="button"
                  className="icon-button"
                  onClick={toggleMute}
                  disabled={!hasTrack}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? "×" : "◖"}
                </button>
                <input
                  type="range"
                  className="player-dock__volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  disabled={!hasTrack}
                  aria-label="Volume"
                />
              </div>

              {/* More Options Button (three dots) */}
              <div className="player-dock__more-container">
                <button
                  type="button"
                  className={`icon-button player-dock__more-btn${menuOpen ? " player-dock__more-btn--active" : ""}`}
                  onClick={() => setMenuOpen(!menuOpen)}
                  disabled={!hasTrack}
                  aria-label="More options"
                  aria-expanded={menuOpen}
                >
                  •••
                </button>

                {menuOpen && hasTrack && (
                  <div className="player-dock__menu" role="menu" aria-label="Playback options">
                    {currentTrack && (
                      <>
                        <AddToPlaylistButton
                          track={currentTrack}
                          renderTrigger={(openModal) => (
                            <button
                              type="button"
                              className="player-dock__menu-btn"
                              onClick={() => {
                                setMenuOpen(false);
                                openModal();
                              }}
                            >
                              <span className="player-dock__menu-icon">+</span>
                              <span>Add to playlist</span>
                            </button>
                          )}
                        />
                        <AddToQueueButton
                          track={currentTrack}
                          renderTrigger={(addToQueue) => (
                            <button
                              type="button"
                              className="player-dock__menu-btn"
                              onClick={() => {
                                setMenuOpen(false);
                                addToQueue();
                              }}
                            >
                              <span className="player-dock__menu-icon">+≡</span>
                              <span>Add to queue</span>
                            </button>
                          )}
                        />
                      </>
                    )}
                    <div className="player-dock__menu-divider" />
                    <button
                      type="button"
                      className={`player-dock__menu-btn${isShuffled ? " player-dock__menu-btn--active" : ""}`}
                      onClick={() => setShuffled(!isShuffled)}
                    >
                      <span className="player-dock__menu-icon">⇄</span>
                      <span>Shuffle: {isShuffled ? "On" : "Off"}</span>
                    </button>
                    <button
                      type="button"
                      className={`player-dock__menu-btn${repeatMode !== "off" ? " player-dock__menu-btn--active" : ""}`}
                      onClick={cycleRepeat}
                    >
                      <span className="player-dock__menu-icon">{repeatMode === "one" ? "↻₁" : "↻"}</span>
                      <span>Repeat: {repeatMode === "one" ? "One" : repeatMode === "all" ? "All" : "Off"}</span>
                    </button>
                    <div className="player-dock__menu-divider" />
                    <button
                      type="button"
                      className="player-dock__menu-btn"
                      onClick={openQueue}
                    >
                      <span className="player-dock__menu-icon">≡</span>
                      <span>Queue ({queue.length})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassSurface>
      </footer>
      <QueuePanel />
    </>
  );
}

function formatTime(seconds: number) {
  if (!seconds) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
