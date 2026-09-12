"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { usePlayerStore } from "@/stores/player-store";
import { useLikesStore } from "@/stores/likes-store";
import { showToast } from "@/stores/toast-store";
import { addTrackToPlaylist, createPlaylist, getUserPlaylists } from "@/lib/music/playlists";
import type { Track, Playlist } from "@/types/music";

export interface TrackActionsProps {
  track: Track;
  variant?: "row" | "dropdown";
  size?: "small" | "normal";
  className?: string;
  onRemoveFromQueue?: () => void;
}

export function TrackActions({
  track,
  variant = "row",
  size = "small",
  className = "",
  onRemoveFromQueue,
}: TrackActionsProps) {
  const { user } = useUser();
  const isLiked = useLikesStore((s) => s.isLiked(track.id));
  const toggleLikeStore = useLikesStore((s) => s.toggleLike);
  const initLikes = useLikesStore((s) => s.init);

  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const playNext = usePlayerStore((s) => s.playNext);

  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [justQueued, setJustQueued] = useState(false);
  const [justPlayedNext, setJustPlayedNext] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize likes store for active user
  useEffect(() => {
    if (user?.id) {
      void initLikes(user.id);
    }
  }, [user?.id, initLikes]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleLike = useCallback(async () => {
    if (!user) {
      showToast("Sign in to like tracks");
      return;
    }
    try {
      const nowLiked = await toggleLikeStore(user.id, track);
      showToast(nowLiked ? "Added to Liked Songs" : "Removed from Liked Songs");
    } catch {
      showToast("Failed to update liked songs");
    }
  }, [user, toggleLikeStore, track]);

  const handleAddToQueue = useCallback(() => {
    addToQueue(track);
    setJustQueued(true);
    showToast("Added to queue");
    setTimeout(() => setJustQueued(false), 1200);
  }, [addToQueue, track]);

  const handlePlayNext = useCallback(() => {
    playNext(track);
    setJustPlayedNext(true);
    showToast("Will play next");
    setTimeout(() => setJustPlayedNext(false), 1200);
  }, [playNext, track]);

  const handleOpenPlaylistModal = useCallback(() => {
    if (!user) {
      showToast("Sign in to manage playlists");
      return;
    }
    setDropdownOpen(false);
    setPlaylistModalOpen(true);
  }, [user]);

  // Dropdown Variant (for cards/tiles and tight spots)
  if (variant === "dropdown") {
    return (
      <div
        className={`track-actions track-actions--dropdown${dropdownOpen ? " track-actions--open" : ""} ${className}`}
        ref={dropdownRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`track-action-btn track-action-btn--menu${size === "small" ? " track-action-btn--small" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!dropdownOpen && dropdownRef.current) {
              const rect = dropdownRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              setOpenUpwards(spaceBelow < 250);
            }
            setDropdownOpen((prev) => !prev);
          }}
          aria-label={`Options for ${track.title}`}
          aria-expanded={dropdownOpen}
          title="More options"
        >
          <svg width={size === "small" ? "15" : "18"} height={size === "small" ? "15" : "18"} viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2.2" />
            <circle cx="12" cy="12" r="2.2" />
            <circle cx="19" cy="12" r="2.2" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className={`track-actions__menu${openUpwards ? " track-actions__menu--upwards" : ""}`} role="menu">
            <button
              type="button"
              className={`track-actions__menu-item${isLiked ? " track-actions__menu-item--liked" : ""}`}
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                void handleLike();
              }}
            >
              <HeartIcon isLiked={isLiked} />
              <span>{isLiked ? "Liked" : "Like"}</span>
            </button>

            <button
              type="button"
              className="track-actions__menu-item"
              role="menuitem"
              onClick={handleOpenPlaylistModal}
            >
              <PlaylistIcon />
              <span>Add to Playlist</span>
            </button>

            <button
              type="button"
              className="track-actions__menu-item"
              role="menuitem"
              onClick={() => {
                setDropdownOpen(false);
                handlePlayNext();
              }}
            >
              <PlayNextIcon />
              <span>Play Next</span>
            </button>

            {onRemoveFromQueue ? (
              <button
                type="button"
                className="track-actions__menu-item track-actions__menu-item--danger"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onRemoveFromQueue();
                }}
              >
                <TrashIcon />
                <span>Remove from Queue</span>
              </button>
            ) : (
              <button
                type="button"
                className="track-actions__menu-item"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  handleAddToQueue();
                }}
              >
                <QueueIcon />
                <span>Add to Queue</span>
              </button>
            )}
          </div>
        )}

        {playlistModalOpen && (
          <PlaylistPickerModal
            track={track}
            onClose={() => setPlaylistModalOpen(false)}
          />
        )}
      </div>
    );
  }

  // Row Variant (default inline icon row for list views)
  return (
    <div
      className={`track-actions track-actions--row ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Like */}
      <button
        type="button"
        className={`track-action-btn track-action-btn--like${isLiked ? " track-action-btn--liked" : ""}${size === "small" ? " track-action-btn--small" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          void handleLike();
        }}
        aria-label={isLiked ? `Remove ${track.title} from liked songs` : `Add ${track.title} to liked songs`}
        title={isLiked ? "Unlike" : "Like"}
      >
        <HeartIcon isLiked={isLiked} />
      </button>

      {/* 2. Add to Playlist */}
      <button
        type="button"
        className={`track-action-btn track-action-btn--playlist${size === "small" ? " track-action-btn--small" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handleOpenPlaylistModal();
        }}
        aria-label={`Add ${track.title} to playlist`}
        title="Add to playlist"
      >
        <PlaylistIcon />
      </button>

      {/* 3. Play Next */}
      <button
        type="button"
        className={`track-action-btn track-action-btn--play-next${justPlayedNext ? " track-action-btn--success" : ""}${size === "small" ? " track-action-btn--small" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handlePlayNext();
        }}
        aria-label={`Play ${track.title} next`}
        title="Play next"
      >
        {justPlayedNext ? <CheckIcon /> : <PlayNextIcon />}
      </button>

      {/* 4. Add to Queue */}
      <button
        type="button"
        className={`track-action-btn track-action-btn--queue${justQueued ? " track-action-btn--success" : ""}${size === "small" ? " track-action-btn--small" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handleAddToQueue();
        }}
        aria-label={`Add ${track.title} to queue`}
        title="Add to queue"
      >
        {justQueued ? <CheckIcon /> : <QueueIcon />}
      </button>

      {playlistModalOpen && (
        <PlaylistPickerModal
          track={track}
          onClose={() => setPlaylistModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Playlist Picker Modal ───────────────────────────────────────────────────

interface PlaylistPickerModalProps {
  track: Track;
  onClose: () => void;
}

function PlaylistPickerModal({ track, onClose }: PlaylistPickerModalProps) {
  const { user } = useUser();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserPlaylists(user.id)
      .then((data) => {
        if (!cancelled) {
          setPlaylists(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[PlaylistPickerModal] Load failed", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAddToPlaylist = async (playlist: Playlist) => {
    try {
      await addTrackToPlaylist(playlist.id, track.id, {
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
      });
      showToast(`Added to ${playlist.name}`);
      onClose();
    } catch (err) {
      console.error("[PlaylistPickerModal] Add failed", err);
      showToast(`Failed to add to ${playlist.name}`);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const playlist = await createPlaylist(user.id, newName.trim());
      await addTrackToPlaylist(playlist.id, track.id, {
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        duration: track.duration,
      });
      showToast(`Created "${playlist.name}" and added track`);
      onClose();
    } catch (err) {
      console.error("[PlaylistPickerModal] Create failed", err);
      showToast("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-label="Add to playlist"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Add to playlist</h3>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-card__body">
          <div className="playlist-picker__new">
            <input
              type="text"
              placeholder="New playlist name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateAndAdd();
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleCreateAndAdd()}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="playlist-picker__list">
            {loading ? (
              <p className="playlist-picker__empty">Loading playlists…</p>
            ) : playlists.length > 0 ? (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  className="playlist-picker__item"
                  onClick={() => void handleAddToPlaylist(pl)}
                >
                  <span className="playlist-picker__item-name">{pl.name}</span>
                  <span className="playlist-picker__item-count">
                    {pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}
                  </span>
                </button>
              ))
            ) : (
              <p className="playlist-picker__empty">
                No playlists yet. Create one above.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function HeartIcon({ isLiked }: { isLiked: boolean }) {
  if (isLiked) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="#ff6b9d"
        stroke="#ff6b9d"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="14" y2="6" />
      <line x1="3" y1="12" x2="14" y2="12" />
      <line x1="3" y1="18" x2="10" y2="18" />
      <line x1="18" y1="13" x2="18" y2="21" />
      <line x1="14" y1="17" x2="22" y2="17" />
    </svg>
  );
}

function PlayNextIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="15" y2="18" />
      <path d="M19 14v6M16 17h6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#a78bfa"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Backward Compatible Exports ─────────────────────────────────────────────

export function LikeButton({ track, size = "normal" }: { track: Track; size?: "small" | "normal" }) {
  const { user } = useUser();
  const isLiked = useLikesStore((s) => s.isLiked(track.id));
  const toggleLikeStore = useLikesStore((s) => s.toggleLike);
  const initLikes = useLikesStore((s) => s.init);

  useEffect(() => {
    if (user?.id) void initLikes(user.id);
  }, [user?.id, initLikes]);

  if (!user) return null;

  return (
    <button
      type="button"
      className={`like-button${isLiked ? " like-button--liked" : ""}${size === "small" ? " like-button--small" : ""}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          const nowLiked = await toggleLikeStore(user.id, track);
          showToast(nowLiked ? "Added to Liked Songs" : "Removed from Liked Songs");
        } catch {
          showToast("Failed to update liked songs");
        }
      }}
      aria-label={isLiked ? "Remove from liked songs" : "Add to liked songs"}
    >
      <HeartIcon isLiked={isLiked} />
    </button>
  );
}

export function AddToPlaylistButton({
  track,
  renderTrigger,
}: {
  track: Track;
  renderTrigger?: (openModal: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <button
          type="button"
          className="add-to-playlist-button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Add to playlist"
        >
          <PlaylistIcon />
        </button>
      )}
      {open && <PlaylistPickerModal track={track} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AddToQueueButton({
  track,
  size = "normal",
  renderTrigger,
}: {
  track: Track;
  size?: "small" | "normal";
  renderTrigger?: (addToQueue: () => void) => React.ReactNode;
}) {
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const [justQueued, setJustQueued] = useState(false);

  const handleClick = useCallback(() => {
    addToQueue(track);
    setJustQueued(true);
    showToast("Added to queue");
    setTimeout(() => setJustQueued(false), 1200);
  }, [addToQueue, track]);

  return (
    <>
      {renderTrigger ? (
        renderTrigger(handleClick)
      ) : (
        <button
          type="button"
          className={`add-to-queue-button${size === "small" ? " add-to-queue-button--small" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          aria-label="Add to queue"
        >
          {justQueued ? <CheckIcon /> : <QueueIcon />}
        </button>
      )}
    </>
  );
}
