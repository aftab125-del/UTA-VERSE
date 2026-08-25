"use client";

import { useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";

interface YouTubeResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

interface YouTubeSearchPanelProps {
  initialQuery?: string;
}

export function YouTubeSearchPanel({ initialQuery = "" }: YouTubeSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTrack = usePlayerStore((state) => state.setTrack);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      const clearState = window.setTimeout(() => {
        setResults([]);
        setError(null);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(clearState);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      console.info("[YouTubeSearch] Query submitted", { query: normalizedQuery });

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as YouTubeResult[] | { error?: string } | null;
        console.info("[YouTubeSearch] Response received", {
          status: response.status,
          resultCount: Array.isArray(payload) ? payload.length : 0,
          error: !Array.isArray(payload) && typeof payload?.error === "string" ? payload.error : null,
        });

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(!Array.isArray(payload) && typeof payload?.error === "string" ? payload.error : "YouTube search failed.");
        }

        setResults(payload);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        const message = requestError instanceof Error ? requestError.message : "YouTube search failed.";
        console.error("[YouTubeSearch] Request failed", { message });
        setResults([]);
        setError(message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <section className="content-section youtube-search" aria-labelledby="youtube-search-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live discovery</p>
          <h2 id="youtube-search-heading">YouTube</h2>
        </div>
        <span className="section-heading__meta">Search the open signal</span>
      </div>
      <label className="search-field__label" htmlFor="youtube-search-input">Search YouTube</label>
      <input
        id="youtube-search-input"
        className="youtube-search__input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Any song, artist, or phrase…"
      />
      {isLoading && <p className="youtube-search__status">Searching YouTube…</p>}
      {error && <p className="youtube-search__status youtube-search__status--error">{error}</p>}
      {!isLoading && !error && query.trim() && !results.length && <p className="youtube-search__status">No YouTube music results found.</p>}
      {results.length > 0 && (
        <div className="youtube-search__results">
          {results.map((result) => (
            <YouTubeResultCard key={result.videoId} result={result} onPlay={() => void setTrack(toTrack(result))} />
          ))}
        </div>
      )}
    </section>
  );
}

function toTrack(result: YouTubeResult): Track {
  return {
    id: `youtube:${result.videoId}`,
    videoId: result.videoId,
    title: result.title,
    artist: result.channelTitle || "YouTube",
    album: "YouTube",
    artwork: result.thumbnail,
    duration: 0,
  };
}

function YouTubeResultCard({ result, onPlay }: { result: YouTubeResult; onPlay: () => void }) {
  return (
    <article className="youtube-result">
      <button type="button" className="youtube-result__button" onClick={onPlay} aria-label={`Play ${result.title} by ${result.channelTitle}`}>
        <img src={result.thumbnail} alt="" className="youtube-result__thumbnail" />
        <span className="youtube-result__icon" aria-hidden="true">▶</span>
      </button>
      <div className="youtube-result__details">
        <h3>{result.title}</h3>
        <p>{result.channelTitle}</p>
      </div>
    </article>
  );
}
