"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { importSpotifyPlaylist, type ImportProgress, type ImportResult } from "@/lib/music/spotify-importer";
import { showToast } from "@/stores/toast-store";

interface SpotifyImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: (result: { id: string; name: string }) => void;
}

export function SpotifyImportModal({ open, onClose, onImported }: SpotifyImportModalProps) {
  const router = useRouter();
  const { user } = useUser();
  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Auto-detect and pre-fill Spotify links from clipboard when modal opens
  useEffect(() => {
    if (!open) {
      setUrl("");
      setIsImporting(false);
      setProgress(null);
      setStatusMessage("");
      setError(null);
      setImportResult(null);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((clipText) => {
          const trimmed = clipText.trim();
          if (
            trimmed.includes("spotify.com/playlist") ||
            trimmed.includes("spotify.link") ||
            trimmed.startsWith("spotify:playlist:")
          ) {
            setUrl(trimmed);
          }
        })
        .catch(() => {
          // Clipboard permission denied or unavailable
        });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isImporting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isImporting, onClose]);

  if (!open || typeof document === "undefined") return null;

  async function handlePasteFromClipboard() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setUrl(text.trim());
      }
    } catch {
      // ignore
    }
  }

  async function handleStartImport(e: React.FormEvent) {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl || isImporting) return;

    setIsImporting(true);
    setError(null);
    setProgress(null);
    setStatusMessage("Connecting to Spotify and extracting tracks...");

    const effectiveUserId = user?.id ?? "local-user";

    try {
      const result = await importSpotifyPlaylist(
        cleanUrl,
        effectiveUserId,
        (p) => {
          setProgress(p);
          setStatusMessage(`Matching and importing tracks (${p.percent}%)...`);
        }
      );

      setImportResult(result);
      setIsImporting(false);
      showToast(`Imported ${result.importedTracks} tracks into "${result.name}"`);
      onImported?.({ id: result.playlistId, name: result.name });
    } catch (err) {
      setIsImporting(false);
      setError(err instanceof Error ? err.message : "Failed to import Spotify playlist.");
    }
  }

  function handleOpenImported() {
    if (!importResult) return;
    onClose();
    router.push(`/playlists/${importResult.playlistId}`);
  }

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-label="Import Spotify playlist"
      onClick={() => {
        if (!isImporting) onClose();
      }}
    >
      <div className="modal-card spotify-import-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-card__header">
          <div className="spotify-modal-header-title">
            <span className="spotify-badge-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.31c-.217.355-.678.47-1.033.253-2.83-1.73-6.393-2.122-10.59-1.164-.407.094-.814-.16-.907-.568-.094-.408.16-.814.568-.907 4.607-1.053 8.563-.604 11.71 1.352.354.217.47.678.252 1.034zm1.468-3.264c-.273.444-.858.587-1.302.314-3.24-1.992-8.18-2.57-12.013-1.405-.498.152-1.03-.133-1.182-.632-.152-.5.133-1.03.632-1.182 4.382-1.33 9.82-.689 13.551 1.603.444.273.587.858.314 1.302zm.126-3.41c-3.885-2.308-10.3-2.522-14.02-1.393-.595.18-1.227-.156-1.408-.75-.18-.596.155-1.228.75-1.408 4.28-1.3 11.375-1.047 15.86 1.614.536.318.71 1.015.392 1.55-.318.536-1.015.71-1.574.387z" />
              </svg>
            </span>
            <h3>Import from Spotify</h3>
          </div>
          {!isImporting && (
            <button type="button" className="modal-card__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-card__body">
          {error && <div className="auth-error">{error}</div>}

          {/* Success State */}
          {importResult ? (
            <div className="spotify-import-success">
              <div className="spotify-import-success__badge">✓</div>
              <h4>Playlist Imported</h4>
              <p>
                Successfully imported <strong>{importResult.importedTracks}</strong> of{" "}
                <strong>{importResult.totalTracks}</strong> tracks into{" "}
                <strong>&quot;{importResult.name}&quot;</strong>.
              </p>
              <div className="spotify-import-success__actions">
                <button
                  type="button"
                  className="liked-songs__play-btn spotify-success-btn"
                  onClick={handleOpenImported}
                >
                  Open Playlist
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : isImporting ? (
            /* Live Progress State */
            <div className="spotify-import-progress-box">
              <div className="spotify-spinner" />
              <div className="spotify-progress-info">
                <h4>{statusMessage}</h4>
                {progress && (
                  <>
                    <p className="spotify-progress-count">
                      Track {progress.current} of {progress.total}
                    </p>
                    <div className="spotify-progress-bar">
                      <div
                        className="spotify-progress-bar__fill"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <p className="spotify-progress-track">
                      {progress.trackLabel}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Default Single Option: Paste Link Form */
            <form onSubmit={(e) => void handleStartImport(e)}>
              <p className="spotify-modal-subtitle">
                Paste a Spotify playlist link to import it into your UTA-VERSE library.
              </p>

              <label className="auth-field">
                <span>Spotify Playlist Link</span>
                <div className="spotify-input-wrapper">
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/..."
                    autoFocus
                  />
                  <button
                    type="button"
                    className="spotify-paste-btn"
                    onClick={() => void handlePasteFromClipboard()}
                    title="Paste from clipboard"
                  >
                    Paste
                  </button>
                </div>
              </label>

              <div className="spotify-modal-hint">
                <span>Supported:</span> Public playlists from open.spotify.com and spotify.link
              </div>

              <div className="modal-card__actions" style={{ marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="liked-songs__play-btn spotify-submit-btn"
                  disabled={!url.trim()}
                >
                  Import Playlist
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
