"use client";

import { useRef, useEffect, useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import "./SpotlightCard.css";

export interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  onClick?: () => void;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(169, 139, 255, 0.45)",
  onClick,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionAllowed(!mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setMotionAllowed(!e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || !motionAllowed) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    divRef.current.style.setProperty("--mouse-x", `${x}px`);
    divRef.current.style.setProperty("--mouse-y", `${y}px`);
    divRef.current.style.setProperty("--spotlight-color", spotlightColor);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={`card-spotlight ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export default SpotlightCard;
