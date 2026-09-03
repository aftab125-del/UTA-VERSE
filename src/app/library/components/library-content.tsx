"use client";

import { useState } from "react";
import { useUser, useLikedTracks } from "@/app/library/components/use-library";
import { LikedSongs } from "@/app/library/components/liked-songs";
import { RecentlyPlayed } from "@/app/library/components/recently-played";

type Tab = "liked" | "recent";

export function LibraryContent() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("liked");

  if (!user) return null;

  return (
    <div className="library-tabs">
      <div className="library-tabs__bar" role="tablist">
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
        {tab === "liked" && <LikedSongs />}
        {tab === "recent" && <RecentlyPlayed />}
      </div>
    </div>
  );
}
