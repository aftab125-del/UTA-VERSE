"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { type Track } from "@/types/music";
import { useUser } from "@/hooks/use-user";
import { useLikesStore } from "@/stores/likes-store";
import { usePlayerStore } from "@/stores/player-store";
import { showToast } from "@/stores/toast-store";
import { cleanTrackTitle, decodeHtmlEntities } from "@/lib/utils/html";

interface TrackOptionsSheetProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onOpenPlaylistModal: () => void;
  onSwitchToLyrics?: () => void;
}

export function TrackOptionsSheet({
  track,
  isOpen,
  onClose,
  onOpenPlaylistModal,
  onSwitchToLyrics,
}: TrackOptionsSheetProps) {
  const router = useRouter();
  const { user } = useUser();
  const setAmbientMode = usePlayerStore((s) => s.setAmbientMode);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const isLiked = useLikesStore((s) => s.isLiked(track.id));
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayTitle = cleanTrackTitle(track.title, track.artist);
  const displayArtist = decodeHtmlEntities(track.artist);
  const displayAlbum = track.album || displayTitle;

  const handleShare = async () => {
    onClose();
    const shareData = {
      title: `${track.title} - UTA-VERSE`,
      text: `Listen to "${track.title}" by ${track.artist} on UTA-VERSE`,
      url: typeof window !== "undefined" ? window.location.href : "https://uta-verse.vercel.app",
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          showToast("Failed to share");
        }
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
      showToast("Link copied to clipboard");
    }
  };

  const handleToggleLike = async () => {
    onClose();
    if (!user) {
      showToast("Sign in to like tracks");
      return;
    }
    try {
      const nowLiked = await toggleLike(user.id, track);
      showToast(nowLiked ? "Added to Liked Songs" : "Removed from Liked Songs");
    } catch {
      showToast("Failed to update liked songs");
    }
  };

  const handleStartAmbientMode = async () => {
    onClose();
    try {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (typeof window !== "undefined" && window.screen.orientation && "lock" in window.screen.orientation) {
        await (window.screen.orientation as unknown as { lock: (o: string) => Promise<void> })
          .lock("landscape")
          .catch(() => {});
      }
    } catch {
      // Ignored if permissions disabled
    }
    setAmbientMode(true);
  };

  const handleViewArtist = () => {
    onClose();
    router.push(`/search?q=${encodeURIComponent(track.artist)}`);
  };

  const handleViewAlbum = () => {
    onClose();
    if (track.album) {
      router.push(`/search?q=${encodeURIComponent(track.album)}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(track.title)}`);
    }
  };

  const handleShowLyrics = () => {
    onClose();
    if (onSwitchToLyrics) {
      onSwitchToLyrics();
    }
  };

  const handleAddToQueue = () => {
    onClose();
    addToQueue(track);
    showToast("Added to queue");
  };

  const handleClearQueue = () => {
    onClose();
    clearQueue();
    showToast("Queue cleared");
  };

  const handleAddToPlaylist = () => {
    onClose();
    onOpenPlaylistModal();
  };

  return (
    <div className="track-options-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        ref={sheetRef}
        className="track-options-sheet"
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {/* Drag handle pill */}
        <div className="track-options-sheet__handle" onClick={onClose} />

        {/* Quick action chips row (Radio, Add, Share) */}
        <div className="track-options-sheet__chips-row">
          <button
            type="button"
            className="track-options-sheet__chip"
            onClick={() => {
              onClose();
              router.push(`/discover?seed=${encodeURIComponent(track.title)}`);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
            </svg>
            <span>Radio</span>
          </button>

          <button
            type="button"
            className="track-options-sheet__chip"
            onClick={handleAddToPlaylist}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add</span>
          </button>

          <button
            type="button"
            className="track-options-sheet__chip"
            onClick={handleShare}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>Share</span>
          </button>
        </div>

        {/* Action List items */}
        <div className="track-options-sheet__list">
          {/* View artist */}
          <button type="button" className="track-options-sheet__item" onClick={handleViewArtist}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>View artist</strong>
              <span>{displayArtist}</span>
            </div>
          </button>

          {/* View album */}
          <button type="button" className="track-options-sheet__item" onClick={handleViewAlbum}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>View album</strong>
              <span>{displayAlbum}</span>
            </div>
          </button>

          {/* Add to library / Like */}
          <button type="button" className="track-options-sheet__item" onClick={handleToggleLike}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isLiked ? "#ff4b72" : "inherit" }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>{isLiked ? "Remove from library" : "Add to library"}</strong>
            </div>
          </button>

          {/* Ambient Mode (Matches reference photo) */}
          <button
            type="button"
            className="track-options-sheet__item track-options-sheet__item--ambient"
            onClick={handleStartAmbientMode}
          >
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong className="track-options-sheet__ambient-title">Ambient Mode</strong>
              <span className="track-options-sheet__ambient-badge">Dock & Lyrics Display</span>
            </div>
          </button>

          {/* Show Lyrics */}
          <button type="button" className="track-options-sheet__item" onClick={handleShowLyrics}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="15" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="11" y2="18" />
                <path d="M18 10v7a2 2 0 1 1-2-2h2" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>Show Lyrics</strong>
            </div>
          </button>

          {/* Add to queue */}
          <button type="button" className="track-options-sheet__item" onClick={handleAddToQueue}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>Add to queue</strong>
            </div>
          </button>

          {/* Clear queue */}
          <button type="button" className="track-options-sheet__item" onClick={handleClearQueue}>
            <div className="track-options-sheet__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="track-options-sheet__item-text">
              <strong>Clear queue</strong>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
