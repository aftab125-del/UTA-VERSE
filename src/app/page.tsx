import Link from "next/link";
import { SectionHeading } from "@/components/layout/section-heading";
import { AppShell } from "@/components/shell/app-shell";
import { BlurText } from "@/components/reactbits/BlurText";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserListeningStats } from "@/lib/music/stats";
import type { UserListeningStats } from "@/lib/music/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadHomeData();
  const { user, displayName, stats } = result.data;

  return (
    <AppShell>
      {/* 1. Hero / Intro Section with Personal Greeting & Tagline */}
      <HomeStage displayName={displayName} isUser={Boolean(user)} />

      <div className="home-content">
        {/* 2. Personal Listening Telemetry Dashboard (React Bits Pro Stats-14 with 3D Tilt) */}
        <PersonalDashboard stats={stats} isGuest={!user} />

        {/* 3. Featured Transmission / Discover CTA */}
        <section className="content-section" aria-labelledby="featured-heading">
          <SectionHeading eyebrow="Live Transmission" title="Featured Sound" />
          <div className="featured-panel">
            <div>
              <p className="featured-panel__eyebrow">Search the open signal</p>
              <h2 id="featured-heading">Sound with room to breathe.</h2>
              <p>Explore millions of tracks, trending releases, and curated frequencies across the UTA-VERSE.</p>
              <Link className="text-button" href="/discover">
                Enter Discover <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="featured-panel__orb" aria-hidden="true" />
          </div>
        </section>

        {/* 4. About UTA-VERSE Section */}
        <section className="content-section" aria-labelledby="about-heading">
          <SectionHeading eyebrow="Platform Philosophy" title="About UTA-VERSE" />
          <div className="about-panel">
            <div className="about-panel__header">
              <div className="about-panel__icon" aria-hidden="true" />
              <p className="about-panel__eyebrow">Origin & Frequency</p>
            </div>
            <h2 id="about-heading" className="about-panel__heading">
              A Universe of Music
            </h2>
            <p className="about-panel__text">
              UTA-VERSE is a dark, cinematic space built for listening, discovery, and the frequencies that stay with you. Engineered from the ground up as a web-first sonic cosmos, it combines personal listening telemetry with high-fidelity playback and atmospheric visuals.
            </p>
            <div className="about-panel__credit">
              <span>✦ Designed & Built by Aftab Kathat</span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

interface HomeDataResult {
  user: { id: string; email?: string } | null;
  displayName: string | null;
  stats: UserListeningStats;
}

async function loadHomeData(): Promise<{ data: HomeDataResult }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authRes } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const user = authRes?.user ?? null;

    let displayName: string | null = null;
    let stats: UserListeningStats;

    if (user) {
      displayName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "Cosmonaut";

      stats = await getUserListeningStats(user.id, supabase);
    } else {
      stats = await getUserListeningStats("", supabase);
    }

    return {
      data: {
        user,
        displayName,
        stats,
      },
    };
  } catch {
    const emptyStats = await getUserListeningStats("", undefined as any);
    return {
      data: {
        user: null,
        displayName: null,
        stats: emptyStats,
      },
    };
  }
}

interface HomeStageProps {
  displayName?: string | null;
  isUser?: boolean;
}

function HomeStage({ displayName, isUser }: HomeStageProps) {
  const headline = isUser ? "Your space in the sound." : "Find your place in the sound.";
  const greeting = isUser && displayName
    ? `Welcome back, ${displayName}. Personal listening telemetry, heavy rotation, and your universe of music.`
    : "UTA-VERSE is a cinematic space for listening, discovery, and the music that stays with you.";

  return (
    <section className="home-stage" aria-labelledby="home-heading">
      <div className="home-stage__veil" aria-hidden="true" />
      <div className="home-stage__content">
        <p className="eyebrow">{isUser ? "Your Orbit" : "The signal is forming"}</p>
        <h1 id="home-heading">
          <BlurText
            text={headline}
            animateBy="words"
            direction="top"
            delay={300}
            stepDuration={0.8}
          />
        </h1>
        <p className="home-stage__lede">{greeting}</p>
        <p className="home-stage__credit">Made by Aftab Kathat</p>
        <div className="home-stage__rule" aria-hidden="true" />
        <p className="home-stage__note">
          {isUser ? "Telemetry active • 30-day rolling window" : "The universe is coming into focus."}
        </p>
      </div>
    </section>
  );
}
