"use client";

import { useEffect, useRef, useState } from "react";
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

export function AmbientModePlayer() {
  const isAmbientMode = usePlayerStore((s) => s.isAmbientMode);
  const setAmbientMode = usePlayerStore((s) => s.setAmbientMode);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
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

  // Menu state for the subtle top-left three dots button (⋮)
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu when tapping/clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest(".ambient-mode__menu-container")) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [menuOpen]);

  // Gesture Feedback HUDs
  const [volumeHud, setVolumeHud] = useState<{ visible: boolean; level: number } | null>(null);
  const volumeHudTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [skipCue, setSkipCue] = useState<"prev" | "next" | null>(null);
  const skipCueTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Synced lyrics calculation
  const hasSyncedLyrics = Boolean(lyricsData?.syncedLyrics && lyricsData.syncedLyrics.length > 0);
  const canSync = hasSyncedLyrics && isSyncValid(lyricsData?.syncedLyrics ?? null, duration);
  const syncedLyrics = canSync && lyricsData?.syncedLyrics ? lyricsData.syncedLyrics : null;
  const activeIndex = syncedLyrics ? findCurrentLyricIndex(syncedLyrics, position) : -1;

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

  // High-precision hardware timestamp reference for 60fps/120fps liquid smooth karaoke flow
  const baseTimeRef = useRef<{ position: number; timestamp: number }>({ position: 0, timestamp: 0 });

  // Re-sync base time with the real audio clock whenever position updates from the engine
  useEffect(() => {
    baseTimeRef.current = {
      position,
      timestamp: performance.now(),
    };
  }, [position]);

  // Buttery-smooth rAF animation loop directly updating --line-progress on activeLineRef DOM node
  useEffect(() => {
    if (!isAmbientMode || !isPlaying || !syncedLyrics || activeIndex < 0) return;

    const activeLine = syncedLyrics[activeIndex];
    if (!activeLine) return;

    const nextLine = syncedLyrics[activeIndex + 1];
    const lineStart = activeLine.time;
    const lineEnd = nextLine ? nextLine.time : lineStart + 4;
    const lineDuration = Math.max(0.4, lineEnd - lineStart);

    let rafId: number;

    const updateSmoothProgress = () => {
      const now = performance.now();
      const elapsedSec = Math.max(0, (now - baseTimeRef.current.timestamp) / 1000);
      const estimatedPos = baseTimeRef.current.position + elapsedSec;
      const ratio = Math.min(1, Math.max(0, (estimatedPos - lineStart) / lineDuration));
      const progressPercent = ratio * 100;

      if (activeLineRef.current) {
        activeLineRef.current.style.setProperty("--line-progress", `${progressPercent.toFixed(2)}%`);
      }

      rafId = requestAnimationFrame(updateSmoothProgress);
    };

    rafId = requestAnimationFrame(updateSmoothProgress);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isAmbientMode, isPlaying, syncedLyrics, activeIndex]);

  const handleUserScroll = () => {
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2800);
  };

  const handleExitAmbientMode = async () => {
    setMenuOpen(false);
    setAmbientMode(false);
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      if (typeof window !== "undefined" && window.screen.orientation && "unlock" in window.screen.orientation) {
        (window.screen.orientation as unknown as { unlock: () => void }).unlock();
      }
    } catch {
      // Ignored if unsupported
    }
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

    // 1. VERTICAL SLIDE: Real-time Audio Volume Adjustment
    if (touchStateRef.current.direction === "vertical") {
      touchStateRef.current.isSwiping = true;
      const screenHeight = window.innerHeight || 400;
      // Dragging upwards (-deltaY) increases volume, downwards decreases
      const volChange = -deltaY / (screenHeight * 0.65);
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
    const { startX, startTime, direction, isSwiping } = touchStateRef.current;
    const touch = e.changedTouches[0];
    const deltaX = touch ? touch.clientX - startX : 0;
    const absX = Math.abs(deltaX);
    const elapsedTime = Date.now() - startTime;

    // Fade out Volume HUD after vertical drag completes
    if (direction === "vertical") {
      if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
      volumeHudTimerRef.current = setTimeout(() => {
        setVolumeHud(null);
      }, 850);
    }

    // HORIZONTAL SLIDE: Trigger song skip on swipe release
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

    // Quick Tap: Close menu if open
    if (!isSwiping && elapsedTime < 350) {
      if (menuOpen) setMenuOpen(false);
    }

    touchStateRef.current.direction = null;
    touchStateRef.current.isSwiping = false;
  };

  if (!isAmbientMode || !currentTrack) return null;

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
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            </>
          ) : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              <span>Previous Track</span>
            </>
          )}
        </div>
      )}

      {/* ── Discreet Three Dots Menu (Photo 2) ── */}
      <div
        className="ambient-mode__menu-container"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ambient-mode__menu-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMenuOpen((prev) => !prev);
          }}
          aria-label="Options"
        >
          ⋮
        </button>

        {menuOpen && (
          <div
            className="ambient-mode__dropdown"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ambient-mode__dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                void handleExitAmbientMode();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void handleExitAmbientMode();
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Back to normal mode</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Pure 2-Column Landscape Stage (Photo 2) ── */}
      <main className="ambient-mode__stage">
        {/* LEFT COLUMN: Prominent Square Album Artwork */}
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
        </section>

        {/* RIGHT COLUMN: Large Synchronized Typography Lyrics (Photo 2) */}
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
                <p>Loading lyrics…</p>
              </div>
            )}

            {!lyricsLoading && syncedLyrics && (
              <div className="ambient-mode__lyrics-lines">
                {syncedLyrics.map((line: SyncedLine, index: number) => {
                  const isActive = index === activeIndex;
                  const isPast = index < activeIndex;

                  let progressPct = 0;
                  if (isActive) {
                    const nextLine = syncedLyrics[index + 1];
                    const lineStart = line.time;
                    const lineEnd = nextLine ? nextLine.time : lineStart + 4;
                    const lineDuration = Math.max(0.6, lineEnd - lineStart);
                    const ratio = Math.min(1, Math.max(0, (position - lineStart) / lineDuration));
                    progressPct = Math.round(ratio * 100);
                  }

                  return (
                    <div
                      key={`amb-${line.time}-${index}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={(e) => {
                        e.stopPropagation();
                        seek(line.time);
                      }}
                      className={`ambient-mode__line${
                        isActive
                          ? " ambient-mode__line--active"
                          : isPast
                          ? " ambient-mode__line--past"
                          : ""
                      }`}
                      style={
                        isActive
                          ? ({ "--line-progress": `${progressPct}%` } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <span className="ambient-mode__line-content">
                        <span className="ambient-mode__line-base">
                          {line.text || "♪"}
                        </span>
                        {isActive && (
                          <span className="ambient-mode__line-sung" aria-hidden="true">
                            {line.text || "♪"}
                          </span>
                        )}
                      </span>
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
                <p>{currentTrack.title}</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
