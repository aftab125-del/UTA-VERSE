"use client";

import React, { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div" | "strong";
  speed?: number; // pixels per second (default: 32)
  separator?: string; // separator between loops (default: " • ")
}

/**
 * High-performance marquee text component modeled after Echo Music's `basicMarquee`.
 * Automatically measures container width vs text width.
 * Only animates when text actually overflows its container.
 * Seamlessly loops with side fade masks and respects `prefers-reduced-motion`.
 */
export function MarqueeText({
  text,
  className = "",
  as: Component = "span",
  speed = 32,
  separator = "   •   ",
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.scrollWidth;

      if (contentWidth > containerWidth + 4) {
        setIsOverflowing(true);
        // Calculate animation duration based on content width + gap for steady speed
        const totalDistance = contentWidth + 48; // content width + gap
        const dur = Math.max(6, totalDistance / speed);
        setDuration(dur);
      } else {
        setIsOverflowing(false);
      }
    };

    measure();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        measure();
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [text, speed]);

  if (!text) return null;

  const content = isOverflowing ? (
    <span className="marquee-track" aria-label={text}>
      <span ref={contentRef} className="marquee-content">
        {text}
        <span className="marquee-separator" aria-hidden="true">
          {separator}
        </span>
      </span>
      <span className="marquee-content" aria-hidden="true">
        {text}
        <span className="marquee-separator" aria-hidden="true">
          {separator}
        </span>
      </span>
    </span>
  ) : (
    <span ref={contentRef} className="marquee-static">
      {text}
    </span>
  );

  const containerClass = `marquee-container ${className}${isOverflowing ? " marquee-container--overflowing" : ""}`;
  const containerStyle = isOverflowing
    ? ({
        "--marquee-duration": `${duration.toFixed(1)}s`,
      } as React.CSSProperties)
    : undefined;

  switch (Component) {
    case "h1":
      return (
        <h1 ref={containerRef as React.Ref<HTMLHeadingElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </h1>
      );
    case "h2":
      return (
        <h2 ref={containerRef as React.Ref<HTMLHeadingElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </h2>
      );
    case "h3":
      return (
        <h3 ref={containerRef as React.Ref<HTMLHeadingElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </h3>
      );
    case "h4":
      return (
        <h4 ref={containerRef as React.Ref<HTMLHeadingElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </h4>
      );
    case "p":
      return (
        <p ref={containerRef as React.Ref<HTMLParagraphElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </p>
      );
    case "div":
      return (
        <div ref={containerRef as React.Ref<HTMLDivElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </div>
      );
    case "strong":
      return (
        <strong ref={containerRef as React.Ref<HTMLElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </strong>
      );
    default:
      return (
        <span ref={containerRef as React.Ref<HTMLSpanElement>} className={containerClass} title={text} style={containerStyle}>
          {content}
        </span>
      );
  }
}
