import { AppShell } from "@/components/shell/app-shell";
import { mockRecentlyPlayed } from "@/data/mock-catalog";
import { SectionHeading } from "@/components/layout/section-heading";
import { TrackCard } from "@/components/music/track-card";

export default function LibraryPage() {
  return <AppShell><div className="route-content"><p className="eyebrow">Your collection</p><h1 className="route-title">Library</h1><p className="route-lede">A home for the tracks and collections you choose to keep close.</p><section className="content-section"><SectionHeading title="Recently Played" /><div className="track-list">{mockRecentlyPlayed.map((track) => <TrackCard key={track.id} track={track} />)}</div></section></div></AppShell>;
}
