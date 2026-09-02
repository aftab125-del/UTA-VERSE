"use client";

import { useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/player-store";
import type { Track } from "@/types/music";
import { TiltedCard } from "@/components/reactbits/TiltedCard";
import { BorderGlow } from "@/components/reactbits/BorderGlow";
import { ChromaGrid } from "@/components/reactbits/ChromaGrid";

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

const VIOLET_THEMES = [
  { borderColor: "#8b5cf6", gradient: "linear-gradient(145deg, rgba(139, 92, 246, 0.4), #06070b)" },
  { borderColor: "#a98bff", gradient: "linear-gradient(145deg, rgba(169, 139, 255, 0.4), #06070b)" },
  { borderColor: "#6d28d9", gradient: "linear-gradient(145deg, rgba(109, 40, 217, 0.4), #06070b)" },
  { borderColor: "#c4b5fd", gradient: "linear-gradient(145deg, rgba(196, 181, 253, 0.4), #06070b)" },
];

export function YouTubeSearchPanel({ initialQuery = "" }: YouTubeSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  const chromaItems = results.map((result, idx) => ({
    image: result.thumbnail,
    title: result.title,
    subtitle: result.channelTitle,
    borderColor: VIOLET_THEMES[idx % VIOLET_THEMES.length].borderColor,
    gradient: VIOLET_THEMES[idx % VIOLET_THEMES.length].gradient,
    onClick: () => void setTrack(toTrack(result)),
  }));

  return (
    <section className="content-section youtube-search" aria-labelledby="youtube-search-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live discovery</p>
          <h2 id="youtube-search-heading">YouTube</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {hasResults && (
            <div className="view-toggle" role="group" aria-label="Results view mode">
              <button
                type="button"
                className={`view-toggle__btn${viewMode === "list" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
              <button
                type="button"
                className={`view-toggle__btn${viewMode === "grid" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>
            </div>
          )}
          <span className="section-heading__meta">Search the open signal</span>
        </div>
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
        viewMode === "grid" ? (
          <ChromaGrid items={chromaItems} />
        ) : (
          <div className="youtube-search__results">
            {results.map((result) => (
              <YouTubeResultCard key={result.videoId} result={result} onPlay={() => void setTrack(toTrack(result))} />
            ))}
          </div>
        )
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
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isCurrent = currentTrack?.id === `youtube:${result.videoId}`;

  const card = (
    <article className={`youtube-result${isCurrent ? " youtube-result--current" : ""}`}>
      <button type="button" className="youtube-result__button" onClick={onPlay} aria-label={`Play ${result.title} by ${result.channelTitle}`}>
        <TiltedCard
          imageSrc={result.thumbnail}
          altText={result.title}
          captionText={result.channelTitle}
          containerWidth="100%"
          containerHeight="100%"
          imageWidth="100%"
          imageHeight="100%"
          showMobileWarning={false}
        />
        <span className="youtube-result__icon" aria-hidden="true">{isCurrent && isPlaying ? "Ⅱ" : "▶"}</span>
      </button>
      <div className="youtube-result__details">
        <h3>{result.title}</h3>
        <p>{result.channelTitle}</p>
      </div>
    </article>
  );

  if (isCurrent) {
    return (
      <BorderGlow
        active={isPlaying}
        colors={["#8b5cf6", "#a78bfa", "#c4b5fd"]}
        glowColor="268 100 76"
        borderRadius={8}
      >
        {card}
      </BorderGlow>
    );
  }

  return card;
}

