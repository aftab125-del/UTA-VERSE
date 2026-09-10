"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePlayerStore } from "@/stores/player-store";
import {
  fetchLyrics,
  findCurrentLyricIndex,
  isSyncValid,
  type LyricsData,
  type SyncedLine,
} from "@/lib/music/lyrics";
import { extractThemePalette, type ThemePalette } from "@/lib/utils/color-extractor";
import { LikeButton, AddToPlaylistButton, AddToQueueButton } from "@/components/ui/track-actions";
import { useUser } from "@/hooks/use-user";
import { useLikesStore } from "@/stores/likes-store";
import { showToast } from "@/stores/toast-store";

export function FullScreenPlayer() {
  const { user } = useUser();
  const isExpanded = usePlayerStore((s) => s.isExpanded);
  const setIsExpanded = usePlayerStore((s) => s.setIsExpanded);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const seek = usePlayerStore((s) => s.seek);
  const previous = usePlayerStore((s) => s.previous);
  const next = usePlayerStore((s) => s.next);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const isShuffled = usePlayerStore((s) => s.isShuffled);
  const setShuffled = usePlayerStore((s) => s.setShuffled);

  const isLiked = useLikesStore((s) => (currentTrack ? s.isLiked(currentTrack.id) : false));
  const toggleLikeStore = useLikesStore((s) => s.toggleLike);
  const initLikes = useLikesStore((s) => s.init);

  const [palette, setPalette] = useState<ThemePalette | null>(null);
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);
  const [mobilePhase, setMobilePhase] = useState<"track" | "lyrics">("track");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);

  // Timeline scrubbing state
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  // User manual scroll lock (prevents auto-scroll fighting user)
  const userScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const mobileLyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const mobileActiveLineRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const handleUserScroll = useCallback(() => {
    userScrolledRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      userScrolledRef.current = false;
    }, 4500);
  }, []);

  const handleSeek = useCallback(
    (targetTime: number) => {
      userScrolledRef.current = false;
      seek(targetTime);
    },
    [seek]
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Initialize likes when user loads
  useEffect(() => {
    if (user?.id) void initLikes(user.id);
  }, [user?.id, initLikes]);

  // Lock body scroll when full-screen player is open
  useEffect(() => {
    if (isExpanded) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isExpanded]);

  // Close on Escape key
  useEffect(() => {
    if (!isExpanded) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsExpanded(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, setIsExpanded]);

  // Close more menu on click outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreMenuOpen]);

  // Extract dynamic theme palette when track changes
  useEffect(() => {
    let isCancelled = false;
    if (!currentTrack?.artwork) {
      Promise.resolve().then(() => {
        if (!isCancelled) setPalette(null);
      });
      return;
    }
    void extractThemePalette(currentTrack.artwork).then((extracted) => {
      if (!isCancelled) setPalette(extracted);
    });
    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.artwork]);

  // Fetch lyrics when track changes
  useEffect(() => {
    let isCancelled = false;
    if (!currentTrack) {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          setLyricsData(null);
          setLyricsError(null);
          setLyricsLoading(false);
        }
      });
      return;
    }

    Promise.resolve().then(() => {
      if (!isCancelled) {
        setLyricsLoading(true);
        setLyricsError(null);
      }
    });

    void fetchLyrics(currentTrack, duration)
      .then((res) => {
        if (isCancelled) return;
        setLyricsLoading(false);
        if (res.success) {
          setLyricsData(res.lyrics);
        } else {
          setLyricsData(null);
          setLyricsError(res.message || "Lyrics not available");
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setLyricsLoading(false);
        setLyricsData(null);
        setLyricsError(err instanceof Error ? err.message : "Failed to load lyrics");
      });

    return () => {
      isCancelled = true;
    };
  }, [currentTrack, duration]);

  const effectivePosition = scrubPosition !== null ? scrubPosition : position;
  const hasSyncedLyrics = Boolean(lyricsData?.syncedLyrics && lyricsData.syncedLyrics.length > 0);
  const canSync = Boolean(hasSyncedLyrics && isSyncValid(lyricsData!.syncedLyrics, duration));
  const hasPlainLyrics = Boolean(lyricsData?.plainLyrics);
  const isInstrumental = Boolean(lyricsData?.instrumental);

  // Active synchronized line index is ONLY computed if lyrics can reliably sync!
  // If canSync is false, activeIndex is -1 so lyrics don't jump around and remain peacefully scrollable.
  const activeIndex =
    canSync && lyricsData?.syncedLyrics?.length
      ? findCurrentLyricIndex(lyricsData.syncedLyrics, effectivePosition)
      : -1;

  // Auto-scroll to active lyric line smoothly on desktop (scoped strictly to lyrics container)
  useEffect(() => {
    if (!canSync || activeIndex < 0) return;
    if (userScrolledRef.current) return;

    if (activeLineRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeEl = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const targetTop =
        activeRect.top -
        containerRect.top +
        currentScrollTop -
        container.clientHeight / 2 +
        activeRect.height / 2;

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }
  }, [activeIndex, canSync]);

  // Auto-scroll to active lyric line smoothly on mobile (scoped strictly to lyrics container)
  useEffect(() => {
    if (!canSync || activeIndex < 0) return;
    if (userScrolledRef.current) return;

    if (mobileActiveLineRef.current && mobileLyricsContainerRef.current) {
      const container = mobileLyricsContainerRef.current;
      const activeEl = mobileActiveLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const targetTop =
        activeRect.top -
        containerRect.top +
        currentScrollTop -
        container.clientHeight / 2 +
        activeRect.height / 2;

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }
  }, [activeIndex, canSync]);

  if (!isExpanded || !currentTrack) return null;

  function cycleRepeat() {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
    const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }

  // Active lyric text for teaser in Phase 1
  const currentLyricTeaser =
    lyricsLoading
      ? "Finding the right words…"
      : activeIndex >= 0 && lyricsData?.syncedLyrics?.[activeIndex]?.text
      ? lyricsData.syncedLyrics[activeIndex].text
      : hasSyncedLyrics || hasPlainLyrics
      ? "Lyrics available (tap to view)"
      : "No lyrics available";

  return (
    <div
      className="fullscreen-player"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded music player with lyrics"
      onWheel={(e) => e.stopPropagation()}
      style={{
        "--theme-dominant": palette?.dominant ?? "rgb(139, 92, 246)",
        "--theme-dominant-hex": palette?.dominantHex ?? "#8b5cf6",
        "--theme-mobile-bg":
          palette?.mobileBackgroundGradient ??
          "linear-gradient(180deg, #221a36 0%, #141022 42%, #0a0812 100%)",
      } as React.CSSProperties}
    >
      {/* 1. Blurred Artwork Ambient Canvas (matches Spotify / Apple Music) */}
      {currentTrack.artwork && (
        <div
          className="fullscreen-player__bg-art"
          style={{ backgroundImage: `url(${currentTrack.artwork})` }}
          aria-hidden="true"
        />
      )}

      {/* 2. Solid Opaque Gradient Overlay (Completely hides underlying page) */}
      <div
        className="fullscreen-player__bg-overlay"
        style={{
          background:
            palette?.backgroundGradient ??
            "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(139, 92, 246, 0.45) 0%, #06070a 90%), #06070a",
        }}
        aria-hidden="true"
      />

      {/* ─── DESKTOP VIEW (>= 769px: Split 2-Column) ────────────────────── */}
      <div className="fullscreen-player__desktop-view">
        <header className="fullscreen-player__header">
          <button
            type="button"
            className="fullscreen-player__collapse-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Collapse player"
            title="Collapse player (Esc)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div className="fullscreen-player__header-info">
            <span className="fullscreen-player__playing-from">Now Playing</span>
            <span className="fullscreen-player__header-title">{currentTrack.title}</span>
          </div>

          <button
            type="button"
            className="fullscreen-player__close-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Close player"
            title="Close player"
          >
            ✕
          </button>
        </header>

        <div className="fullscreen-player__body">
          {/* Left: Track Details & Controls */}
          <div className="fullscreen-player__track-view">
            <div className="fullscreen-player__art-container">
              {currentTrack.artwork ? (
                <img
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  className="fullscreen-player__art-img"
                />
              ) : (
                <div className="fullscreen-player__art-placeholder" />
              )}
              <div
                className="fullscreen-player__art-glow"
                style={{
                  boxShadow: `0 20px 70px ${palette?.glowColor ?? "rgba(139, 92, 246, 0.4)"}`,
                }}
              />
            </div>

            <div className="fullscreen-player__meta">
              <div className="fullscreen-player__titles">
                <h2 className="fullscreen-player__track-title">{currentTrack.title}</h2>
                <p className="fullscreen-player__artist-name">{currentTrack.artist}</p>
              </div>
              <div className="fullscreen-player__actions">
                <LikeButton track={currentTrack} size="normal" />
                <AddToPlaylistButton track={currentTrack} />
                <AddToQueueButton track={currentTrack} size="normal" />
              </div>
            </div>

            {/* Timeline Seek Bar */}
            <div className="fullscreen-player__timeline">
              <span className="fullscreen-player__time">
                {formatTime(scrubPosition !== null ? scrubPosition : position)}
              </span>
              <input
                type="range"
                className="fullscreen-player__slider"
                min="0"
                max={duration || 1}
                value={scrubPosition !== null ? scrubPosition : Math.min(position, duration || 1)}
                onPointerDown={() => {
                  userScrolledRef.current = false;
                }}
                onChange={(e) => {
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
                aria-label="Track progress"
                style={{
                  accentColor: palette?.dominantHex ?? "#8b5cf6",
                }}
              />
              <span className="fullscreen-player__time">
                {formatRemainingTime(scrubPosition !== null ? scrubPosition : position, duration)}
              </span>
            </div>

            {/* Transport Controls */}
            <div className="fullscreen-player__controls">
              <button
                type="button"
                className={`fullscreen-player__ctrl-btn${isShuffled ? " fullscreen-player__ctrl-btn--active" : ""}`}
                onClick={() => setShuffled(!isShuffled)}
                aria-label="Toggle shuffle"
                title="Shuffle"
              >
                ⇄
              </button>

              <button
                type="button"
                className="fullscreen-player__ctrl-btn"
                onClick={previous}
                aria-label="Previous track"
              >
                ◀◀
              </button>

              <button
                type="button"
                className="fullscreen-player__play-btn"
                style={{
                  background: palette?.dominantHex ?? "#8b5cf6",
                }}
                onClick={() => void togglePlayPause()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "Ⅱ" : "▶"}
              </button>

              <button
                type="button"
                className="fullscreen-player__ctrl-btn"
                onClick={next}
                aria-label="Next track"
              >
                ▶▶
              </button>

              <button
                type="button"
                className={`fullscreen-player__ctrl-btn${repeatMode !== "off" ? " fullscreen-player__ctrl-btn--active" : ""}`}
                onClick={cycleRepeat}
                aria-label="Cycle repeat mode"
                title="Repeat"
              >
                {repeatMode === "one" ? "↻₁" : "↻"}
              </button>
            </div>
          </div>

          {/* Right: Synced Lyrics View */}
          <div className="fullscreen-player__lyrics-view">
            <div className="fullscreen-player__lyrics-header">
              <div className="fullscreen-player__lyrics-title-group">
                <h3 className="fullscreen-player__lyrics-title">Lyrics</h3>
                {hasSyncedLyrics && (
                  <span
                    className="fullscreen-player__synced-badge"
                    style={{
                      borderColor: canSync
                        ? (palette?.dominantHex ?? "rgba(169, 139, 255, 0.5)")
                        : "rgba(255, 255, 255, 0.25)",
                      color: canSync ? (palette?.accent ?? "#ffffff") : "rgba(255, 255, 255, 0.75)",
                    }}
                    title={canSync ? "Lyrics synchronized to track" : "Manual scrolling mode"}
                  >
                    {canSync ? "Synchronized" : "Scrollable"}
                  </span>
                )}
              </div>
            </div>

            <div
              ref={lyricsContainerRef}
              className="fullscreen-player__lyrics-scroll"
              onWheel={handleUserScroll}
              onTouchMove={handleUserScroll}
              onPointerDown={handleUserScroll}
              tabIndex={0}
              role="region"
              aria-label="Song lyrics"
            >
              {lyricsLoading && (
                <div className="fullscreen-player__lyrics-status">
                  <div className="fullscreen-player__pulse" />
                  <p>Loading synchronized lyrics…</p>
                </div>
              )}

              {!lyricsLoading && isInstrumental && (
                <div className="fullscreen-player__lyrics-status">
                  <span className="fullscreen-player__status-icon">♫</span>
                  <p>Instrumental track — Enjoy the music</p>
                </div>
              )}

              {!lyricsLoading && !isInstrumental && hasSyncedLyrics && lyricsData?.syncedLyrics && (
                <div className="fullscreen-player__synced-lines">
                  {lyricsData.syncedLyrics.map((line: SyncedLine, index: number) => {
                    const isActive = canSync && index === activeIndex;
                    return (
                      <div
                        key={`${line.time}-${index}`}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => handleSeek(line.time)}
                        className={`fullscreen-player__line${isActive ? " fullscreen-player__line--active" : ""}${!canSync ? " fullscreen-player__line--scrollable" : ""}`}
                        style={{
                          color: isActive
                            ? (palette?.accent ?? "#ffffff")
                            : !canSync
                            ? "rgba(255, 255, 255, 0.85)"
                            : undefined,
                          textShadow: isActive
                            ? `0 0 24px ${palette?.glowColor ?? "rgba(139, 92, 246, 0.6)"}`
                            : undefined,
                        }}
                        role="button"
                        tabIndex={0}
                        title={`Jump to ${formatTime(line.time)}`}
                      >
                        {line.text || "♪"}
                      </div>
                    );
                  })}
                </div>
              )}

              {!lyricsLoading && !isInstrumental && !hasSyncedLyrics && hasPlainLyrics && (
                <div className="fullscreen-player__plain-lyrics">
                  <pre>{lyricsData?.plainLyrics}</pre>
                </div>
              )}

              {!lyricsLoading && !isInstrumental && !hasSyncedLyrics && !hasPlainLyrics && (
                <div className="fullscreen-player__lyrics-status">
                  <p className="fullscreen-player__not-found">
                    {lyricsError || "Lyrics not available for this track."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE 2-PHASE VIEW (< 769px) ──────────────────────────────── */}
      <div className="fullscreen-player__mobile-view">
        {/* PHASE 1: NOW PLAYING / TRACK PHASE (matches media_1789028231353.jpg) */}
        {mobilePhase === "track" && (
          <div className="fullscreen-player__mobile-phase1">
            {/* Large Top Artwork with Soft Bottom Dissolve */}
            <div className="fullscreen-player__phase1-art-wrap">
              <button
                type="button"
                className="fullscreen-player__collapse-circle-btn"
                onClick={() => setIsExpanded(false)}
                aria-label="Collapse player"
                title="Collapse player"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {currentTrack.artwork ? (
                <img
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  className="fullscreen-player__phase1-art-img"
                />
              ) : (
                <div className="fullscreen-player__art-placeholder" />
              )}
            </div>

            {/* Bottom Content Area */}
            <div className="fullscreen-player__phase1-content">
              {/* Track Info Row */}
              <div className="fullscreen-player__phase1-info-row">
                <div className="fullscreen-player__phase1-titles">
                  <h2 className="fullscreen-player__phase1-title">{currentTrack.title}</h2>
                  <p className="fullscreen-player__phase1-artist">{currentTrack.artist}</p>
                </div>

                {/* Circular More Options Button */}
                <div className="fullscreen-player__more-wrapper" ref={moreMenuRef}>
                  <button
                    type="button"
                    className="fullscreen-player__more-circle-btn"
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    aria-label="More options"
                  >
                    •••
                  </button>
                  {moreMenuOpen && (
                    <div className="fullscreen-player__more-dropdown">
                      <button
                        type="button"
                        className="fullscreen-player__menu-item"
                        onClick={async () => {
                          setMoreMenuOpen(false);
                          if (!user) {
                            showToast("Sign in to like tracks");
                            return;
                          }
                          try {
                            const nowLiked = await toggleLikeStore(user.id, currentTrack);
                            showToast(nowLiked ? "Added to Liked Songs" : "Removed from Liked Songs");
                          } catch {
                            showToast("Failed to update liked songs");
                          }
                        }}
                      >
                        {isLiked ? "♥ Remove from liked" : "♡ Like track"}
                      </button>
                      <AddToPlaylistButton
                        track={currentTrack}
                        renderTrigger={(openModal) => (
                          <button
                            type="button"
                            className="fullscreen-player__menu-item"
                            onClick={() => {
                              setMoreMenuOpen(false);
                              openModal();
                            }}
                          >
                            + Add to playlist
                          </button>
                        )}
                      />
                      <AddToQueueButton
                        track={currentTrack}
                        renderTrigger={(addToQueue) => (
                          <button
                            type="button"
                            className="fullscreen-player__menu-item"
                            onClick={() => {
                              setMoreMenuOpen(false);
                              addToQueue();
                            }}
                          >
                            +≡ Add to queue
                          </button>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Live Lyric Snippet / Teaser (Tap to open Phase 2 Lyrics) */}
              <div
                className="fullscreen-player__lyric-teaser"
                onClick={() => setMobilePhase("lyrics")}
                role="button"
                tabIndex={0}
                title="Tap for full synchronized lyrics"
              >
                <span className="fullscreen-player__teaser-text">{currentLyricTeaser}</span>
              </div>

              {/* Seek Bar */}
              <div className="fullscreen-player__phase1-timeline">
                <input
                  type="range"
                  className="fullscreen-player__phase1-slider"
                  min="0"
                  max={duration || 1}
                  value={scrubPosition !== null ? scrubPosition : Math.min(position, duration || 1)}
                  onPointerDown={() => {
                    userScrolledRef.current = false;
                  }}
                  onChange={(e) => {
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
                  aria-label="Track progress"
                  style={{ accentColor: "#ffffff" }}
                />
                <div className="fullscreen-player__time-row">
                  <span>{formatTime(scrubPosition !== null ? scrubPosition : position)}</span>
                  <span>{formatRemainingTime(scrubPosition !== null ? scrubPosition : position, duration)}</span>
                </div>
              </div>

              {/* Transport Playback Controls */}
              <div className="fullscreen-player__phase1-controls">
                <button
                  type="button"
                  className="fullscreen-player__phase1-ctrl-btn"
                  onClick={previous}
                  aria-label="Previous"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="11 19 2 12 11 5 11 19" />
                    <polygon points="22 19 13 12 22 5 22 19" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="fullscreen-player__phase1-play-btn"
                  onClick={() => void togglePlayPause()}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="4" width="4.5" height="16" rx="1.5" />
                      <rect x="14.5" y="4" width="4.5" height="16" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "3px" }}>
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="fullscreen-player__phase1-ctrl-btn"
                  onClick={next}
                  aria-label="Next"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 19 22 12 13 5 13 19" />
                    <polygon points="2 19 11 12 2 5 2 19" />
                  </svg>
                </button>
              </div>

              {/* Volume Row */}
              <div className="fullscreen-player__phase1-volume-row">
                <button
                  type="button"
                  className="fullscreen-player__vol-icon-btn"
                  onClick={toggleMute}
                  aria-label="Mute"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  </svg>
                </button>

                <input
                  type="range"
                  className="fullscreen-player__vol-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />

                <button
                  type="button"
                  className="fullscreen-player__vol-icon-btn"
                  onClick={() => setVolume(1)}
                  aria-label="Full volume"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Bottom Actions Row: Shuffle, Repeat, Infinity, Lyrics */}
              <div className="fullscreen-player__phase1-bottom-actions">
                <button
                  type="button"
                  className={`fullscreen-player__bottom-action-btn${isShuffled ? " fullscreen-player__bottom-action-btn--active" : ""}`}
                  onClick={() => setShuffled(!isShuffled)}
                  aria-label="Shuffle"
                  title="Shuffle"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`fullscreen-player__bottom-action-btn${repeatMode !== "off" ? " fullscreen-player__bottom-action-btn--active" : ""}`}
                  onClick={cycleRepeat}
                  aria-label="Repeat"
                  title="Repeat"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`fullscreen-player__bottom-action-btn${isInfinite ? " fullscreen-player__bottom-action-btn--active" : ""}`}
                  onClick={() => {
                    const nextVal = !isInfinite;
                    setIsInfinite(nextVal);
                    showToast(nextVal ? "Autoplay similar tracks enabled" : "Autoplay disabled");
                  }}
                  aria-label="Autoplay"
                  title="Autoplay similar tracks"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.178 8c5.096 0 5.096 8 0 8-2.678 0-4.678-2.667-6.178-4.667-1.5 2-3.5 4.667-6.178 4.667-5.096 0-5.096-8 0-8 2.678 0 4.678 2.667 6.178 4.667 1.5-2 3.5-4.667 6.178-4.667z" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="fullscreen-player__bottom-action-btn fullscreen-player__bottom-action-btn--lyrics"
                  onClick={() => setMobilePhase("lyrics")}
                  aria-label="Open lyrics"
                  title="Open lyrics"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="16" y2="6" />
                    <line x1="3" y1="12" x2="14" y2="12" />
                    <line x1="3" y1="18" x2="11" y2="18" />
                    <path d="M19 8v8a2 2 0 1 1-2-2h2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: FULL LYRICS PHASE (matches media_1789028231319.jpg) */}
        {mobilePhase === "lyrics" && (
          <div className="fullscreen-player__mobile-phase2">
            {/* Top Drag Indicator */}
            <div
              className="fullscreen-player__phase2-drag-handle"
              onClick={() => setMobilePhase("track")}
              role="button"
              tabIndex={0}
              aria-label="Switch to track view"
              title="Back to track view"
            />

            {/* Compact Track Header */}
            <div className="fullscreen-player__phase2-header">
              <div
                className="fullscreen-player__phase2-track-summary"
                onClick={() => setMobilePhase("track")}
                role="button"
                tabIndex={0}
                title="Back to track view"
              >
                {currentTrack.artwork ? (
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title}
                    className="fullscreen-player__phase2-mini-art"
                  />
                ) : (
                  <div className="fullscreen-player__phase2-mini-placeholder" />
                )}
                <div className="fullscreen-player__phase2-titles">
                  <span className="fullscreen-player__phase2-title">{currentTrack.title}</span>
                  <span className="fullscreen-player__phase2-artist">{currentTrack.artist}</span>
                </div>
              </div>

              <div className="fullscreen-player__more-wrapper" ref={moreMenuRef}>
                <button
                  type="button"
                  className="fullscreen-player__more-circle-btn"
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  aria-label="More options"
                >
                  •••
                </button>
                {moreMenuOpen && (
                  <div className="fullscreen-player__more-dropdown">
                    <button
                      type="button"
                      className="fullscreen-player__menu-item"
                      onClick={async () => {
                        setMoreMenuOpen(false);
                        if (!user) {
                          showToast("Sign in to like tracks");
                          return;
                        }
                        try {
                          const nowLiked = await toggleLikeStore(user.id, currentTrack);
                          showToast(nowLiked ? "Added to Liked Songs" : "Removed from Liked Songs");
                        } catch {
                          showToast("Failed to update liked songs");
                        }
                      }}
                    >
                      {isLiked ? "♥ Remove from liked" : "♡ Like track"}
                    </button>
                    <AddToPlaylistButton
                      track={currentTrack}
                      renderTrigger={(openModal) => (
                        <button
                          type="button"
                          className="fullscreen-player__menu-item"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            openModal();
                          }}
                        >
                          + Add to playlist
                        </button>
                      )}
                    />
                    <AddToQueueButton
                      track={currentTrack}
                      renderTrigger={(addToQueue) => (
                        <button
                          type="button"
                          className="fullscreen-player__menu-item"
                          onClick={() => {
                            setMoreMenuOpen(false);
                            addToQueue();
                          }}
                        >
                          +≡ Add to queue
                        </button>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Beamed Musical Note Icon */}
            <div className="fullscreen-player__phase2-note-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H9c-1.1 0-2 .9-2 2v9.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h10v7.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V5c0-1.1-.9-2-2-2z" />
              </svg>
            </div>

            {/* Full Synced Scrolling Lyrics Area */}
            <div
              ref={mobileLyricsContainerRef}
              className="fullscreen-player__phase2-lyrics-scroll"
              onWheel={handleUserScroll}
              onTouchMove={handleUserScroll}
              onPointerDown={handleUserScroll}
              tabIndex={0}
              role="region"
              aria-label="Song lyrics"
            >
              {lyricsLoading && (
                <div className="fullscreen-player__lyrics-status">
                  <div className="fullscreen-player__pulse" />
                  <p>Loading synchronized lyrics…</p>
                </div>
              )}

              {!lyricsLoading && isInstrumental && (
                <div className="fullscreen-player__lyrics-status">
                  <span className="fullscreen-player__status-icon">♫</span>
                  <p>Instrumental track — Enjoy the melody</p>
                </div>
              )}

              {!lyricsLoading && !isInstrumental && hasSyncedLyrics && lyricsData?.syncedLyrics && (
                <div className="fullscreen-player__phase2-synced-lines">
                  {lyricsData.syncedLyrics.map((line: SyncedLine, index: number) => {
                    const isActive = canSync && index === activeIndex;
                    return (
                      <div
                        key={`m-${line.time}-${index}`}
                        ref={isActive ? mobileActiveLineRef : null}
                        onClick={() => handleSeek(line.time)}
                        className={`fullscreen-player__phase2-line${isActive ? " fullscreen-player__phase2-line--active" : ""}${!canSync ? " fullscreen-player__phase2-line--scrollable" : ""}`}
                        style={{
                          color: isActive
                            ? (palette?.accent ?? "#ffffff")
                            : !canSync
                            ? "rgba(255, 255, 255, 0.88)"
                            : undefined,
                          textShadow: isActive
                            ? `0 0 28px ${palette?.glowColor ?? "rgba(139, 92, 246, 0.6)"}`
                            : undefined,
                        }}
                        role="button"
                        tabIndex={0}
                        title={`Jump to ${formatTime(line.time)}`}
                      >
                        {line.text || "♪"}
                      </div>
                    );
                  })}
                </div>
              )}

              {!lyricsLoading && !isInstrumental && !hasSyncedLyrics && hasPlainLyrics && (
                <div className="fullscreen-player__plain-lyrics">
                  <pre>{lyricsData?.plainLyrics}</pre>
                </div>
              )}

              {!lyricsLoading && !isInstrumental && !hasSyncedLyrics && !hasPlainLyrics && (
                <div className="fullscreen-player__lyrics-status">
                  <p className="fullscreen-player__not-found">
                    {lyricsError || "Lyrics not available for this track."}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Timeline */}
            <div className="fullscreen-player__phase2-timeline">
              <input
                type="range"
                className="fullscreen-player__phase1-slider"
                min="0"
                max={duration || 1}
                value={scrubPosition !== null ? scrubPosition : Math.min(position, duration || 1)}
                onPointerDown={() => {
                  userScrolledRef.current = false;
                }}
                onChange={(e) => {
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
                aria-label="Track progress"
                style={{ accentColor: "#ffffff" }}
              />
              <div className="fullscreen-player__time-row">
                <span>{formatTime(scrubPosition !== null ? scrubPosition : position)}</span>
                <span>{formatRemainingTime(scrubPosition !== null ? scrubPosition : position, duration)}</span>
              </div>
            </div>

            {/* Bottom Pill Bar (Lyrics by LRCLIB + Close Button) */}
            <div className="fullscreen-player__phase2-footer">
              <div className="fullscreen-player__provider-pill">
                Lyrics by LRCLIB{canSync ? " • Synced" : " • Scrollable"}
              </div>
              <button
                type="button"
                className="fullscreen-player__phase2-close-btn"
                onClick={() => setMobilePhase("track")}
                aria-label="Back to track"
                title="Back to track view"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatRemainingTime(position: number, duration: number) {
  const remaining = Math.max(0, duration - position);
  if (!remaining || isNaN(remaining)) return "-0:00";
  return `-${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
}
