"use client";

import Link from "next/link";
import { Stats14Card } from "@/components/dashboard/stats-14-card";
import { STATS_WINDOW_DAYS } from "@/lib/music/stats";
import type { UserListeningStats } from "@/lib/music/stats";

interface PersonalDashboardProps {
  stats: UserListeningStats;
  isGuest?: boolean;
}

export function PersonalDashboard({ stats, isGuest = false }: PersonalDashboardProps) {
  return (
    <section className="dashboard-stats-section" aria-labelledby="dashboard-stats-heading">
      <div className="dashboard-stats-header">
        <div className="dashboard-stats-header__title">
          <p className="dashboard-stats-header__eyebrow">Telemetry & Orbit</p>
          <h2 id="dashboard-stats-heading" className="dashboard-stats-header__heading">
            {isGuest ? "Live Platform Pulse" : "Your Listening Orbit"}
          </h2>
        </div>

        <div className="dashboard-stats-header__window-badge" title={`Aggregated across the last ${STATS_WINDOW_DAYS} days`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Last {STATS_WINDOW_DAYS} Days</span>
        </div>
      </div>

      {/* 3D Telemetry Grid — parent container preserves perspective without overflow flattening */}
      <div className="dashboard-stats-grid">
        {stats.items.map((stat) => (
          <Stats14Card key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Guest or Zero-Data Prompt */}
      {isGuest ? (
        <div className="dashboard-empty-banner">
          <div className="dashboard-empty-banner__text">
            <span className="dashboard-empty-banner__icon" aria-hidden="true">✦</span>
            <span>Sign in to unlock personalized listening time, artist loyalty streaks, and real-time sonic telemetry.</span>
          </div>
          <Link href="/auth/signin" className="text-button">
            Sign In to Track Orbit <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : !stats.hasHistory ? (
        <div className="dashboard-empty-banner">
          <div className="dashboard-empty-banner__text">
            <span className="dashboard-empty-banner__icon" aria-hidden="true">⚡</span>
            <span>Your universe is fresh. Play any track or album to start recording your 30-day listening telemetry.</span>
          </div>
          <Link href="/discover" className="text-button">
            Explore Frequencies <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
