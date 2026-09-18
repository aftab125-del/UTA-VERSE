"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { showToast } from "@/stores/toast-store";
import type { PlaylistWithTracks } from "@/types/music";

interface MobilePlaylistHeaderProps {
  playlist: PlaylistWithTracks;
  isOwner: boolean;
  isPlaying: boolean;
  isCurrentPlaylistPlaying: boolean;
  isShuffled: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPlayAll: () => void;
  onShufflePlay: () => void;
  onOpenSort: () => void;
  onOpenEditDetails: () => void;
  onOpenAddTracks: () => void;
  onOpenReorder: () => void;
  onAddAllToQueue: () => void;
}

export function MobilePlaylistHeader({
  playlist,
  isOwner,
  isPlaying,
  isCurrentPlaylistPlaying,
  isShuffled,
  searchQuery,
  onSearchChange,
  onPlayAll,
  onShufflePlay,
  onOpenSort,
  onOpenEditDetails,
  onOpenAddTracks,
  onOpenReorder,
  onAddAllToQueue,
}: MobilePlaylistHeaderProps) {
  const { displayName, avatarUrl } = useUser();
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Monitor scroll to stick title + green play button at the top
  useEffect(() => {
    function handleScroll() {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      // When hero bottom goes above the top bar (~70px)
      setScrolledPastHero(rect.bottom <= 70);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Share functionality
  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: playlist.name,
          text: `Listen to "${playlist.name}" on UTA-VERSE`,
          url,
        });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast("Playlist link copied to clipboard");
    }
  }

  // Creator name & avatar
  const creatorName = isOwner ? displayName : "User";
  const creatorAvatar = isOwner ? avatarUrl : null;

  // Format total duration
  const totalSeconds = playlist.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

  // Stacked mini covers (up to 3 distinct track artworks)
  const previewArtworks = playlist.tracks
    .map((t) => t.artwork)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="mobile-playlist-header-container">
      {/* ── Sticky Top Bar when Scrolled ── */}
      <div className={`mobile-sticky-top-bar${scrolledPastHero ? " mobile-sticky-top-bar--visible" : ""}`}>
        <Link href="/playlists" className="mobile-top-bar__back-btn" aria-label="Back to playlists">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <h2 className="mobile-sticky-top-bar__title">{playlist.name}</h2>

        {/* Collapsed Green Play Button */}
        <button
          type="button"
          className="mobile-sticky-top-bar__play-btn"
          onClick={onPlayAll}
          aria-label={isCurrentPlaylistPlaying && isPlaying ? "Pause" : "Play"}
        >
          {isCurrentPlaylistPlaying && isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1.5" />
              <rect x="14" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "2px" }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Top Bar with Back Arrow & "Find in playlist" Search ── */}
      <div className="mobile-top-search-row">
        <Link href="/playlists" className="mobile-top-bar__back-btn" aria-label="Back to playlists">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <div className="mobile-find-search-wrap">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="mobile-find-search-input"
            placeholder="Find in playlist"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="mobile-find-clear-btn"
              onClick={() => onSearchChange("")}
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Playlist Hero Card ── */}
      <div className="mobile-hero" ref={heroRef}>
        {/* Large Cover Artwork */}
        <div className="mobile-hero__art-wrap">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt="" className="mobile-hero__cover-img" />
          ) : previewArtworks.length > 0 ? (
            <img src={previewArtworks[0]} alt="" className="mobile-hero__cover-img" />
          ) : (
            <div className="mobile-hero__empty-art">♪</div>
          )}
        </div>

        {/* Title */}
        <h1 className="mobile-hero__title">{playlist.name}</h1>

        {/* Creator Attribution */}
        <div className="mobile-hero__creator-row">
          <div className="mobile-hero__avatar">
            {creatorAvatar ? (
              <img src={creatorAvatar} alt="" width={22} height={22} className="mobile-hero__avatar-img" />
            ) : (
              <span className="mobile-hero__avatar-initials">
                {creatorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="mobile-hero__avatar-badge" aria-hidden="true">+</span>
          </div>
          <span className="mobile-hero__creator-name">{creatorName}</span>
        </div>

        {/* Metadata Row: Globe / Lock + Total duration */}
        <div className="mobile-hero__meta-row">
          {playlist.isPublic ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Public playlist">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Private playlist">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          <span>{durationText}</span>
        </div>

        {/* ── Primary Action Strip ── */}
        <div className="mobile-hero__action-strip">
          {/* Left Sub-strip: Stacked mini covers, Share, 3-dots */}
          <div className="mobile-hero__action-strip-left">
            {/* Stacked Mini Album Covers Preview Badge */}
            <div className="mobile-stacked-covers" title="Tracks preview">
              {previewArtworks.length > 0 ? (
                previewArtworks.map((art, idx) => (
                  <img
                    key={idx}
                    src={art}
                    alt=""
                    className={`mobile-stacked-cover mobile-stacked-cover--${idx}`}
                  />
                ))
              ) : (
                <div className="mobile-stacked-cover mobile-stacked-cover--0 mobile-stacked-cover--empty">♪</div>
              )}
            </div>

            {/* Share Button */}
            <button
              type="button"
              className="mobile-action-icon-btn"
              onClick={() => void handleShare()}
              aria-label="Share playlist"
              title="Share"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>

            {/* Three Dots Menu Button */}
            <div className="mobile-playlist-menu-wrap">
              <button
                type="button"
                className="mobile-action-icon-btn"
                onClick={() => setPlaylistMenuOpen(!playlistMenuOpen)}
                aria-label="More playlist options"
                title="More options"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>

              {playlistMenuOpen && (
                <div className="mobile-playlist-dropdown" onClick={() => setPlaylistMenuOpen(false)}>
                  <button type="button" className="mobile-playlist-dropdown__btn" onClick={onAddAllToQueue}>
                    <span>+≡</span>
                    <span>Add to queue</span>
                  </button>
                  <button type="button" className="mobile-playlist-dropdown__btn" onClick={() => void handleShare()}>
                    <span>➦</span>
                    <span>Share</span>
                  </button>
                  {isOwner && (
                    <button type="button" className="mobile-playlist-dropdown__btn" onClick={onOpenEditDetails}>
                      <span>✎</span>
                      <span>Edit details</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sub-strip: Shuffle + Hero Green Play Circle */}
          <div className="mobile-hero__action-strip-right">
            {/* Shuffle Button with Green Dot Indicator */}
            <button
              type="button"
              className={`mobile-shuffle-btn${isShuffled ? " mobile-shuffle-btn--active" : ""}`}
              onClick={onShufflePlay}
              aria-label="Shuffle play"
              title="Shuffle"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              {isShuffled && <span className="mobile-shuffle-dot" aria-hidden="true" />}
            </button>

            {/* Big Green Play Button */}
            <button
              type="button"
              className="mobile-hero-play-btn"
              onClick={onPlayAll}
              aria-label={isCurrentPlaylistPlaying && isPlaying ? "Pause" : "Play"}
            >
              {isCurrentPlaylistPlaying && isPlaying ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4.5" height="16" rx="1.5" />
                  <rect x="13.5" y="4" width="4.5" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "3px" }}>
                  <polygon points="5 3 20 12 5 21 5 3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Quick Action Pills Ribbon ── */}
        <div className="mobile-pills-ribbon">
          {isOwner && (
            <button
              type="button"
              className="mobile-pill-btn"
              onClick={onOpenAddTracks}
            >
              <span className="mobile-pill-btn__icon">+</span>
              <span>Add</span>
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              className="mobile-pill-btn"
              onClick={onOpenReorder}
            >
              <span className="mobile-pill-btn__icon">≡</span>
              <span>Edit</span>
            </button>
          )}

          <button
            type="button"
            className="mobile-pill-btn"
            onClick={onOpenSort}
          >
            <span className="mobile-pill-btn__icon">⇅</span>
            <span>Sort</span>
          </button>

          {isOwner && (
            <button
              type="button"
              className="mobile-pill-btn"
              onClick={onOpenEditDetails}
            >
              <span className="mobile-pill-btn__icon">✎</span>
              <span>Name and details</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
