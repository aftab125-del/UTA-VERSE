"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePlayerStore } from "@/stores/player-store";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  fetchLyrics,
  findCurrentLyricIndex,
  isSyncValid,
  type LyricsData,
  type SyncedLine,
} from "@/lib/music/lyrics";
import { extractThemePalette, DEFAULT_PALETTE, type ThemePalette } from "@/lib/utils/color-extractor";
import { cleanTrackTitle, decodeHtmlEntities } from "@/lib/utils/html";
import { TrackOptionsSheet } from "@/components/player/track-options-sheet";
import { PlaylistPickerModal } from "@/components/ui/track-actions";
import { type Track } from "@/types/music";

export function AmbientModePlayer() {
  const isAmbientMode = usePlayerStore((s) => s.isAmbientMode);
  const setAmbientMode = usePlayerStore((s) => s.setAmbientMode);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const seek = usePlayerStore((s) => s.seek);
  const previous = usePlayerStore((s) => s.previous);
  const next = usePlayerStore((s) => s.next);

  // Keep screen awake while Ambient Mode is active and playing
  useWakeLock(isAmbientMode && isPlaying);

  // Palette & Background
  const [palette, setPalette] = useState<ThemePalette>(DEFAULT_PALETTE);

  // Lyrics state
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // Auto-hiding HUD controls
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture Feedback HUDs
  const [volumeHud, setVolumeHud] = useState<{ visible: boolean; level: number } | null>(null);
  const volumeHudTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [skipCue, setSkipCue] = useState<"prev" | "next" | null>(null);
  const skipCueTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Options Sheet & Modal
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Timeline scrub
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  // Refs for scrolling lyrics
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture Tracking Ref
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    startVolume: number;
    direction: "horizontal" | "vertical" | null;
    isSwiping: boolean;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    startVolume: volume,
    direction: null,
    isSwiping: false,
  });

  // Extract palette on track change
  useEffect(() => {
    let isSubscribed = true;
    if (!currentTrack?.artwork) {
      void Promise.resolve().then(() => {
        if (isSubscribed) setPalette(DEFAULT_PALETTE);
      });
      return () => {
        isSubscribed = false;
      };
    }

    void extractThemePalette(currentTrack.artwork).then((res) => {
      if (isSubscribed) setPalette(res);
    });
    return () => {
      isSubscribed = false;
    };
  }, [currentTrack?.artwork]);

  // Fetch lyrics on track change
  useEffect(() => {
    let isSubscribed = true;
    if (!currentTrack) {
      void Promise.resolve().then(() => {
        if (isSubscribed) setLyricsData(null);
      });
      return () => {
        isSubscribed = false;
      };
    }

    void Promise.resolve().then(() => {
      if (isSubscribed) setLyricsLoading(true);
    });

    void fetchLyrics(currentTrack, duration)
      .then((res) => {
        if (!isSubscribed) return;
        if (res.success) {
          setLyricsData(res.lyrics);
        } else {
          setLyricsData(null);
        }
      })
      .catch(() => {
        if (!isSubscribed) return;
        setLyricsData(null);
      })
      .finally(() => {
        if (isSubscribed) setLyricsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentTrack, duration]);

  // Auto-hide controls after 3.5s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  useEffect(() => {
    if (!isAmbientMode) return;
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [isAmbientMode]);

  // Handle Fullscreen state change
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignored if permissions disabled
    }
  };

  // Synced lyrics calculation
  const hasSyncedLyrics = Boolean(lyricsData?.syncedLyrics && lyricsData.syncedLyrics.length > 0);
  const canSync = hasSyncedLyrics && isSyncValid(lyricsData?.syncedLyrics ?? null, duration);
  const activeIndex = canSync && lyricsData?.syncedLyrics ? findCurrentLyricIndex(lyricsData.syncedLyrics, position) : -1;

  // Auto-scroll active lyric line to vertical center
  useEffect(() => {
    if (!canSync || activeIndex < 0 || isUserScrollingRef.current) return;
    const lineElem = activeLineRef.current;
    const container = lyricsContainerRef.current;
    if (!lineElem || !container) return;

    const containerHeight = container.clientHeight;
    const lineTop = lineElem.offsetTop;
    const lineHeight = lineElem.clientHeight;

    container.scrollTo({
      top: lineTop - containerHeight / 2 + lineHeight / 2,
      behavior: "smooth",
    });
  }, [activeIndex, canSync]);

  const handleUserScroll = () => {
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2800);
  };

  // ── Touch Gesture Dispatcher ──────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      startVolume: volume,
      direction: null,
      isSwiping: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine gesture direction once movement exceeds threshold
    if (!touchStateRef.current.direction) {
      if (absX > 10 || absY > 10) {
        if (absY > absX) {
          touchStateRef.current.direction = "vertical";
        } else {
          touchStateRef.current.direction = "horizontal";
        }
      }
    }

    // 1. VERTICAL SLIDE: Real-time Volume Adjustment
    if (touchStateRef.current.direction === "vertical") {
      touchStateRef.current.isSwiping = true;
      const screenHeight = window.innerHeight || 400;
      // Dragging upwards (-deltaY) increases volume, downwards decreases
      const volChange = -deltaY / (screenHeight * 0.7);
      const newVol = Math.max(0, Math.min(1, touchStateRef.current.startVolume + volChange));
      setVolume(newVol);

      // Show Volume HUD
      setVolumeHud({ visible: true, level: Math.round(newVol * 100) });
      if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
    }

    // 2. HORIZONTAL SLIDE: Song Navigation Preview
    if (touchStateRef.current.direction === "horizontal") {
      touchStateRef.current.isSwiping = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const { startX, startY, startTime, direction, isSwiping } = touchStateRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch ? touch.clientX - startX : 0;
    const deltaY = touch ? touch.clientY - startY : 0;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsedTime = Date.now() - startTime;

    // Fade out Volume HUD after vertical drag completes
    if (direction === "vertical") {
      if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
      volumeHudTimerRef.current = setTimeout(() => {
        setVolumeHud(null);
      }, 850);
    }

    // HORIZONTAL SLIDE: Trigger song skip on release
    if (direction === "horizontal" && absX > 45) {
      if (deltaX < 0) {
        // Swipe Left: Next Song
        next();
        setSkipCue("next");
      } else {
        // Swipe Right: Previous Song
        previous();
        setSkipCue("prev");
      }
      if (skipCueTimerRef.current) clearTimeout(skipCueTimerRef.current);
      skipCueTimerRef.current = setTimeout(() => setSkipCue(null), 900);
    }

    // SINGLE TAP (<12px displacement, <350ms duration): Toggle Controls
    if (!isSwiping && absX < 12 && absY < 12 && elapsedTime < 350) {
      if (showControls) {
        setShowControls(false);
      } else {
        resetControlsTimer();
      }
    }

    touchStateRef.current.direction = null;
    touchStateRef.current.isSwiping = false;
  };

  if (!isAmbientMode || !currentTrack) return null;

  const displayTitle = cleanTrackTitle(currentTrack.title, currentTrack.artist);
  const displayArtist = decodeHtmlEntities(currentTrack.artist);

  return (
    <div
      className="ambient-mode"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        "--ambient-dominant": palette.dominant,
        "--ambient-glow": palette.glowColor,
        "--ambient-bg": palette.backgroundGradient,
      } as React.CSSProperties}
    >
      {/* ── Dynamic Ambient Blur Backdrop ── */}
      <div className="ambient-mode__backdrop" aria-hidden="true">
        {currentTrack.artwork && (
          <div
            className="ambient-mode__backdrop-image"
            style={{ backgroundImage: `url(${currentTrack.artwork})` }}
          />
        )}
        <div className="ambient-mode__backdrop-mesh" />
        <div className="ambient-mode__backdrop-vignette" />
      </div>

      {/* ── Gesture Feedback Overlay HUDs ── */}
      {/* 1. Volume Slide HUD */}
      {volumeHud && (
        <div className="ambient-hud ambient-hud--volume">
          <div className="ambient-hud__icon">
            {volumeHud.level === 0 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2.5" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className="ambient-hud__bar-track">
            <div
              className="ambient-hud__bar-fill"
              style={{ width: `${volumeHud.level}%` }}
            />
          </div>
          <span className="ambient-hud__value">{volumeHud.level}%</span>
        </div>
      )}

      {/* 2. Song Skip Direction Cue */}
      {skipCue && (
        <div className="ambient-hud ambient-hud--skip">
          {skipCue === "next" ? (
            <>
              <span>Next Track</span>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            </>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              <span>Previous Track</span>
            </>
          )}
        </div>
      )}

      {/* ── Top Bar Controls (Auto-Hides) ── */}
      <header className={`ambient-mode__header${showControls ? " ambient-mode__header--visible" : ""}`}>
        <button
          type="button"
          className="ambient-mode__icon-btn"
          onClick={() => setOptionsOpen(true)}
          aria-label="Track options"
        >
          •••
        </button>

        <div className="ambient-mode__header-info">
          <span className="ambient-mode__badge">Ambient Mode</span>
        </div>

        <div className="ambient-mode__header-actions">
          <button
            type="button"
            className="ambient-mode__icon-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="ambient-mode__icon-btn ambient-mode__close-btn"
            onClick={() => setAmbientMode(false)}
            aria-label="Exit Ambient Mode"
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── Main Stage (2-Column Landscape dock matching reference photo) ── */}
      <main className="ambient-mode__stage">
        {/* LEFT COLUMN: Album Cover Artwork & Elevation */}
        <section className="ambient-mode__art-column">
          <div className="ambient-mode__art-card">
            {currentTrack.artwork ? (
              <img
                src={currentTrack.artwork}
                alt={currentTrack.title}
                className="ambient-mode__cover-img"
              />
            ) : (
              <div className="ambient-mode__art-placeholder" />
            )}
            <div className="ambient-mode__art-glow" />
          </div>

          <div className="ambient-mode__track-meta">
            <h1 className="ambient-mode__title">{displayTitle}</h1>
            <p className="ambient-mode__artist">{displayArtist}</p>
          </div>
        </section>

        {/* RIGHT COLUMN: Synchronized Scrolling Lyrics (Photo 2) */}
        <section className="ambient-mode__lyrics-column">
          <div
            ref={lyricsContainerRef}
            className="ambient-mode__lyrics-scroller"
            onWheel={handleUserScroll}
            onTouchMove={handleUserScroll}
          >
            {lyricsLoading && (
              <div className="ambient-mode__lyrics-status">
                <div className="ambient-mode__pulse-orb" />
                <p>Loading verses…</p>
              </div>
            )}

            {!lyricsLoading && canSync && lyricsData?.syncedLyrics && (
              <div className="ambient-mode__lyrics-lines">
                {lyricsData.syncedLyrics.map((line: SyncedLine, index: number) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={`amb-${line.time}-${index}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={(e) => {
                        e.stopPropagation();
                        seek(line.time);
                      }}
                      className={`ambient-mode__line${isActive ? " ambient-mode__line--active" : ""}`}
                    >
                      {line.text || "♪"}
                    </div>
                  );
                })}
              </div>
            )}

            {!lyricsLoading && !canSync && lyricsData?.plainLyrics && (
              <div className="ambient-mode__plain-lyrics">
                <pre>{lyricsData.plainLyrics}</pre>
              </div>
            )}

            {!lyricsLoading && !canSync && !lyricsData?.plainLyrics && (
              <div className="ambient-mode__no-lyrics">
                <span className="ambient-mode__music-glyph">♫</span>
                <p>Listening to {displayTitle}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ── Bottom Floating Controls (Auto-Hides after 3.5s) ── */}
      <footer className={`ambient-mode__footer${showControls ? " ambient-mode__footer--visible" : ""}`}>
        {/* Scrub Slider */}
        <div className="ambient-mode__timeline">
          <span className="ambient-mode__time-text">
            {formatTime(scrubPosition !== null ? scrubPosition : position)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 1}
            value={scrubPosition !== null ? scrubPosition : Math.min(position, duration || 1)}
            onChange={(e) => {
              resetControlsTimer();
              const val = Number(e.target.value);
              setScrubPosition(val);
              seek(val);
            }}
            onPointerUp={() => {
              if (scrubPosition !== null) {
                seek(scrubPosition);
                setScrubPosition(null);
              }
            }}
            className="ambient-mode__slider"
            aria-label="Track progress"
          />
          <span className="ambient-mode__time-text">
            {formatTime(duration)}
          </span>
        </div>

        {/* Transport buttons pill */}
        <div className="ambient-mode__transport-pill">
          <button
            type="button"
            className="ambient-mode__ctrl-btn"
            onClick={(e) => {
              e.stopPropagation();
              resetControlsTimer();
              previous();
            }}
            aria-label="Previous track"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="11 19 2 12 11 5 11 19" />
              <polygon points="22 19 13 12 22 5 22 19" />
            </svg>
          </button>

          <button
            type="button"
            className="ambient-mode__play-btn"
            onClick={(e) => {
              e.stopPropagation();
              resetControlsTimer();
              void togglePlayPause();
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="ambient-mode__ctrl-btn"
            onClick={(e) => {
              e.stopPropagation();
              resetControlsTimer();
              next();
            }}
            aria-label="Next track"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 19 22 12 13 5 13 19" />
              <polygon points="2 19 11 12 2 5 2 19" />
            </svg>
          </button>
        </div>
      </footer>

      {/* Track Options Bottom Sheet */}
      <TrackOptionsSheet
        track={currentTrack}
        isOpen={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onOpenPlaylistModal={() => setPlaylistModalTrack(currentTrack)}
      />

      {playlistModalTrack && (
        <PlaylistPickerModal
          track={playlistModalTrack}
          onClose={() => setPlaylistModalTrack(null)}
        />
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
