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

type YouTubeSearchPayload =
  | YouTubeResult[]
  | {
      results?: unknown;
      items?: unknown;
      data?: unknown;
      error?: string;
    }
  | null;

function normalizeYouTubeResult(item: unknown): YouTubeResult | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const videoId =
    typeof raw.videoId === "string" && raw.videoId
      ? raw.videoId
      : typeof raw.id === "string" && raw.id
      ? raw.id
      : typeof (raw.id as Record<string, unknown> | undefined)?.videoId === "string"
      ? ((raw.id as Record<string, unknown>).videoId as string)
      : null;

  if (!videoId) return null;

  const snippet = (raw.snippet as Record<string, unknown> | undefined) ?? {};

  const title =
    typeof raw.title === "string" && raw.title
      ? raw.title
      : typeof snippet.title === "string" && snippet.title
      ? snippet.title
      : "Untitled Track";

  const channelTitle =
    typeof raw.channelTitle === "string" && raw.channelTitle
      ? raw.channelTitle
      : typeof snippet.channelTitle === "string" && snippet.channelTitle
      ? snippet.channelTitle
      : "YouTube";

  const thumbnails = snippet.thumbnails as Record<string, Record<string, unknown>> | undefined;
  const thumbnail =
    typeof raw.thumbnail === "string" && raw.thumbnail
      ? raw.thumbnail
      : typeof thumbnails?.medium?.url === "string"
      ? (thumbnails.medium.url as string)
      : typeof thumbnails?.high?.url === "string"
      ? (thumbnails.high.url as string)
      : typeof thumbnails?.default?.url === "string"
      ? (thumbnails.default.url as string)
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    videoId,
    title,
    channelTitle,
    thumbnail,
  };
}

function extractResults(payload: YouTubeSearchPayload): YouTubeResult[] {
  if (!payload || typeof payload !== "object") return [];

  let rawList: unknown[] = [];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else {
    for (const value of [payload.results, payload.items, payload.data]) {
      if (Array.isArray(value)) {
        rawList = value;
        break;
      }
      if (value && typeof value === "object") {
        const nested = value as { results?: unknown; items?: unknown };
        if (Array.isArray(nested.results)) {
          rawList = nested.results;
          break;
        }
        if (Array.isArray(nested.items)) {
          rawList = nested.items;
          break;
        }
      }
    }
  }

  return rawList.map(normalizeYouTubeResult).filter((item): item is YouTubeResult => item !== null);
}

export function YouTubeSearchPanel({ initialQuery = "" }: YouTubeSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTrack = usePlayerStore((state) => state.setTrack);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

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
        const payload = (await response.json().catch(() => null)) as YouTubeSearchPayload;
        const nextResults = extractResults(payload);
        console.info("[YouTubeSearch] Response received", {
          status: response.status,
          resultCount: nextResults.length,
          error: payload && !Array.isArray(payload) && typeof payload.error === "string" ? payload.error : null,
        });

        if (!response.ok) {
          throw new Error(payload && !Array.isArray(payload) && typeof payload.error === "string" ? payload.error : "YouTube search failed.");
        }

        setResults(nextResults);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        const message = requestError instanceof Error ? requestError.message : "YouTube search failed.";
        console.error("[YouTubeSearch] Request failed", { message });
        setResults([]);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const hasResults = results.length > 0;
  const showEmptyState = !isLoading && !error && query.trim().length > 0 && !hasResults;

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
      {showEmptyState && <p className="youtube-search__status">No YouTube music results found.</p>}
      {!isLoading && hasResults && (
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
