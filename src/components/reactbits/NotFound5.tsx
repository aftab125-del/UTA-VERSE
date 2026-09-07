"use client";

import Link from "next/link";
import "./NotFound5.css";

export interface NotFound5Props {
  badgeText?: string;
  heading?: string;
  lede?: string;
  primaryActionText?: string;
  primaryActionHref?: string;
  secondaryActionText?: string;
  secondaryActionHref?: string;
}

export function NotFound5({
  badgeText = "SIGNAL LOST • ERR 404",
  heading = "This frequency doesn't exist in the UTA-VERSE.",
  lede = "The audio stream or coordinates you requested are adrift in deep space or have been decommissioned.",
  primaryActionText = "Back to Home",
  primaryActionHref = "/",
  secondaryActionText = "Explore Discover",
  secondaryActionHref = "/discover",
}: NotFound5Props) {
  return (
    <div className="not-found-5-wrapper">
      {/* Scattered Floating Audio Cards */}
      <div className="not-found-5-scattered-cards" aria-hidden="true">
        {/* Card 1: Top Left */}
        <div className="not-found-card not-found-card--1">
          <div className="not-found-card__thumb not-found-card__thumb--purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div className="not-found-card__meta">
            <span className="not-found-card__title">Lost Frequency</span>
            <span className="not-found-card__subtitle">Deep Space Audio • 0.0 kHz</span>
          </div>
        </div>

        {/* Card 2: Top Right */}
        <div className="not-found-card not-found-card--2">
          <div className="not-found-card__thumb not-found-card__thumb--cyan">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <div className="not-found-card__meta">
            <span className="not-found-card__title">Cosmic Drift</span>
            <span className="not-found-card__subtitle">Nebula Transmission</span>
          </div>
        </div>

        {/* Card 3: Bottom Left */}
        <div className="not-found-card not-found-card--3">
          <div className="not-found-card__thumb not-found-card__thumb--violet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>
          <div className="not-found-card__meta">
            <span className="not-found-card__title">Uncharted Sector</span>
            <span className="not-found-card__subtitle">FLAC • 96kHz Lossless</span>
          </div>
        </div>

        {/* Card 4: Bottom Right */}
        <div className="not-found-card not-found-card--4">
          <div className="not-found-card__thumb not-found-card__thumb--emerald">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="not-found-card__meta">
            <span className="not-found-card__title">Signal Terminated</span>
            <span className="not-found-card__subtitle">OFFLINE • Carrier Muted</span>
          </div>
        </div>
      </div>

      {/* Main Centered 404 Display */}
      <div className="not-found-5-container">
        <div className="not-found-5-center">
          <div className="not-found-signal-badge">
            <span className="not-found-signal-dot" aria-hidden="true" />
            <span>{badgeText}</span>
          </div>

          <div className="not-found-5-number" aria-label="404">
            404
          </div>

          <h1 className="not-found-5-heading">{heading}</h1>
          <p className="not-found-5-lede">{lede}</p>

          <div className="not-found-5-actions">
            <Link href={primaryActionHref} className="not-found-btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
              </svg>
              <span>{primaryActionText}</span>
            </Link>

            <Link href={secondaryActionHref} className="not-found-btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span>{secondaryActionText}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
