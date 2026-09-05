"use client";

import { useState } from "react";
import { PlaylistsGrid } from "@/components/playlist/playlists-grid";
import { LikedSongsSection } from "@/components/playlist/liked-songs-section";
import { RecentlyPlayedSection } from "@/components/playlist/recently-played-section";

type Tab = "playlists" | "liked" | "recent";

export function PlaylistsPageContent({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("playlists");

  return (
    <div className="library-tabs">
      <div className="library-tabs__bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "playlists"}
          className={`library-tabs__tab${tab === "playlists" ? " library-tabs__tab--active" : ""}`}
          onClick={() => setTab("playlists")}
        >
          Playlists
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "liked"}
          className={`library-tabs__tab${tab === "liked" ? " library-tabs__tab--active" : ""}`}
          onClick={() => setTab("liked")}
        >
          Liked Songs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recent"}
          className={`library-tabs__tab${tab === "recent" ? " library-tabs__tab--active" : ""}`}
          onClick={() => setTab("recent")}
        >
          Recently Played
        </button>
      </div>
      <div role="tabpanel">
        {tab === "playlists" && <PlaylistsGrid userId={userId} />}
        {tab === "liked" && <LikedSongsSection />}
        {tab === "recent" && <RecentlyPlayedSection />}
      </div>
    </div>
  );
}
