import { AppShell } from "@/components/shell/app-shell";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";
import { BlurText } from "@/components/reactbits/BlurText";
import { YouTubeSearchPanel } from "@/components/search/youtube-search-panel";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return (
    <AppShell>
      <DarkVeilBackground />
      <div className="route-content route-content--narrow">
        <p className="eyebrow">Tune the signal</p>
        <h1 className="route-title">
          <BlurText text="Search" animateBy="words" direction="top" delay={300} stepDuration={0.8} />
        </h1>
        <p className="route-lede">Discover any song live on YouTube.</p>
        <YouTubeSearchPanel initialQuery={query} />
      </div>
    </AppShell>
  );
}
