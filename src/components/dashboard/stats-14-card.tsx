"use client";

import { useId } from "react";
import type { StatItem } from "@/lib/music/stats";
import { TiltWrapper } from "@/components/ui/tilt-wrapper";
import "./stats-14.css";

interface Stats14CardProps {
  stat: StatItem;
  className?: string;
  rotateAmplitude?: number;
  scaleOnHover?: number;
}

export function Stats14Card({
  stat,
  className = "",
  rotateAmplitude = 14,
  scaleOnHover = 1.04,
}: Stats14CardProps) {
  const gradientId = useId().replace(/:/g, "-");

  return (
    <TiltWrapper
      className={`stats14-card-wrapper ${className}`.trim()}
      innerClassName="stats14-card"
      rotateAmplitude={rotateAmplitude}
      scaleOnHover={scaleOnHover}
    >
      {/* Top: Icon + Label + Delta Chip */}
      <div className="stats14-card__top">
        <div className="stats14-card__label-group">
          <div className="stats14-card__icon" aria-hidden="true">
            {renderStatIcon(stat.iconType)}
          </div>
          <span className="stats14-card__label" title={stat.label}>
            {stat.label}
          </span>
        </div>

        {stat.delta && (
          <div className={`stats14-badge stats14-badge--${stat.delta.trend}`}>
            {stat.delta.trend === "up" && "↗ "}
            {stat.delta.trend === "down" && "↘ "}
            {stat.delta.value}
          </div>
        )}
      </div>

      {/* Middle: Big Metric Value & Subtitle */}
      <div className="stats14-card__body">
        <div className="stats14-card__value" title={stat.value}>
          {stat.value}
        </div>
        <div className="stats14-card__subtitle" title={stat.subtitle}>
          {stat.subtitle}
        </div>
      </div>

      {/* Bottom: SVG Telemetry Sparkline */}
      <div className="stats14-card__sparkline-box" aria-hidden="true">
        <SparklineSvg data={stat.sparkline || []} gradientId={gradientId} />
      </div>
    </TiltWrapper>
  );
}

interface SparklineSvgProps {
  data: number[];
  gradientId: string;
}

function SparklineSvg({ data, gradientId }: SparklineSvgProps) {
  // Ensure we have at least 6 points for a smooth sparkline
  const points = data.length >= 2 ? data : [0, 0, 0, 0, 0, 0, 0, 0];
  const width = 280;
  const height = 48;
  const paddingY = 4;

  const max = Math.max(...points, 1);
  const min = 0;
  const range = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const normalizedY = (val - min) / range;
    const y = height - paddingY - normalizedY * (height - paddingY * 2);
    return { x, y };
  });

  // Construct smooth bezier SVG path
  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const lastPoint = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="stats14-sparkline-svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a98bff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gradient Fill Area */}
      <path d={areaD} fill={`url(#grad-${gradientId})`} className="stats14-sparkline-area" />

      {/* Glowing Stroke Line */}
      <path d={pathD} fill="none" className="stats14-sparkline-line" />

      {/* Latest Data Point Dot */}
      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3"
          className="stats14-sparkline-dot"
        />
      )}
    </svg>
  );
}

function renderStatIcon(type: StatItem["iconType"]) {
  switch (type) {
    case "time":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "artist":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      );
    case "track":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "streak":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case "unique":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "top-track":
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
  }
}
