"use client";

import { useRef, useEffect, useState } from "react";
import type { PointerEvent, MouseEvent } from "react";
import { gsap } from "gsap";
import "./ChromaGrid.css";

export interface ChromaGridItem {
  image: string;
  title: string;
  subtitle?: string;
  handle?: string;
  location?: string;
  borderColor?: string;
  gradient?: string;
  url?: string;
  onClick?: () => void;
}

export interface ChromaGridProps {
  items: ChromaGridItem[];
  className?: string;
  radius?: number;
  columns?: number;
  rows?: number;
  damping?: number;
  fadeOut?: number;
  ease?: string;
  onItemClick?: (item: ChromaGridItem, index: number) => void;
}

export function ChromaGrid({
  items,
  className = "",
  radius = 280,
  columns = 3,
  rows = 2,
  damping = 0.45,
  fadeOut = 0.6,
  ease = "power3.out",
  onItemClick,
}: ChromaGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const setX = useRef<((value: number) => void) | null>(null);
  const setY = useRef<((value: number) => void) | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionAllowed(!mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setMotionAllowed(!e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (!motionAllowed) return;
    const el = rootRef.current;
    if (!el) return;
    setX.current = gsap.quickSetter(el, "--x", "px") as (value: number) => void;
    setY.current = gsap.quickSetter(el, "--y", "px") as (value: number) => void;
    const { width, height } = el.getBoundingClientRect();
    pos.current = { x: width / 2, y: height / 2 };
    setX.current?.(pos.current.x);
    setY.current?.(pos.current.y);
  }, [motionAllowed]);

  const moveTo = (x: number, y: number) => {
    if (!motionAllowed) return;
    gsap.to(pos.current, {
      x,
      y,
      duration: damping,
      ease,
      onUpdate: () => {
        setX.current?.(pos.current.x);
        setY.current?.(pos.current.y);
      },
      overwrite: true,
    });
  };

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!rootRef.current || !motionAllowed) return;
    const r = rootRef.current.getBoundingClientRect();
    moveTo(e.clientX - r.left, e.clientY - r.top);
    if (fadeRef.current) {
      gsap.to(fadeRef.current, { opacity: 0, duration: 0.25, overwrite: true });
    }
  };

  const handleLeave = () => {
    if (!fadeRef.current || !motionAllowed) return;
    gsap.to(fadeRef.current, {
      opacity: 1,
      duration: fadeOut,
      overwrite: true,
    });
  };

  const handleCardClick = (item: ChromaGridItem, index: number) => {
    if (item.onClick) {
      item.onClick();
    } else if (onItemClick) {
      onItemClick(item, index);
    }
  };

  const handleCardMove = (e: MouseEvent<HTMLElement>) => {
    if (!motionAllowed) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      ref={rootRef}
      className={`chroma-grid ${className}`.trim()}
      style={
        {
          "--r": `${radius}px`,
          "--cols": columns,
          "--rows": rows,
        } as React.CSSProperties
      }
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {items.map((c, i) => (
        <article
          key={i}
          className="chroma-card"
          onMouseMove={handleCardMove}
          onClick={() => handleCardClick(c, i)}
          style={
            {
              "--card-border": c.borderColor || "#8b5cf6",
              "--card-gradient": c.gradient || "linear-gradient(145deg, #18142c, #06070b)",
            } as React.CSSProperties
          }
        >
          <div className="chroma-img-wrapper">
            <img src={c.image} alt={c.title} loading="lazy" />
            <div className="chroma-play-overlay" aria-hidden="true">
              <span className="chroma-play-badge">▶</span>
            </div>
          </div>
          <footer className="chroma-info">
            <h3 className="name">{c.title}</h3>
            {c.subtitle && <p className="role">{c.subtitle}</p>}
          </footer>
        </article>
      ))}
      {motionAllowed && (
        <>
          <div className="chroma-overlay" aria-hidden="true" />
          <div ref={fadeRef} className="chroma-fade" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export default ChromaGrid;
