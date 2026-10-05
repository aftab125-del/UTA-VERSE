"use client";

import { useState } from "react";
import { PlaylistsGrid } from "@/components/playlist/playlists-grid";
import { LikedSongsSection } from "@/components/playlist/liked-songs-section";
import { RecentlyPlayedSection } from "@/components/playlist/recently-played-section";

import type { Playlist } from "@/types/music";

type Tab = "playlists" | "liked" | "recent";

export function PlaylistsPageContent({
  userId,
  initialPlaylists = [],
}: {
  userId: string;
  initialPlaylists?: Playlist[];
}) {
  const [tab, setTab] = useState<Tab>("playlists");
  const [hasVisitedLiked, setHasVisitedLiked] = useState(false);
  const [hasVisitedRecent, setHasVisitedRecent] = useState(false);

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === "liked") setHasVisitedLiked(true);
    if (nextTab === "recent") setHasVisitedRecent(true);
  };

  return (
    <div className="library-tabs">
      <div className="library-tabs__bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "playlists"}
          className={`library-tabs__tab${tab === "playlists" ? " library-tabs__tab--active" : ""}`}
          onClick={() => handleTabChange("playlists")}
        >
          Playlists
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "liked"}
          className={`library-tabs__tab${tab === "liked" ? " library-tabs__tab--active" : ""}`}
          onClick={() => handleTabChange("liked")}
        >
          Liked Songs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recent"}
          className={`library-tabs__tab${tab === "recent" ? " library-tabs__tab--active" : ""}`}
          onClick={() => handleTabChange("recent")}
        >
          Recently Played
        </button>
      </div>
      <div role="tabpanel" className="library-tabs__panels">
        <div style={{ display: tab === "playlists" ? "block" : "none" }}>
          <PlaylistsGrid userId={userId} initialPlaylists={initialPlaylists} />
        </div>
        <div style={{ display: tab === "liked" ? "block" : "none" }}>
          {hasVisitedLiked && <LikedSongsSection />}
        </div>
        <div style={{ display: tab === "recent" ? "block" : "none" }}>
          {hasVisitedRecent && <RecentlyPlayedSection />}
        </div>
      </div>
    </div>
  );
}
