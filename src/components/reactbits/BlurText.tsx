"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, TargetAndTransition } from "framer-motion";

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: TargetAndTransition;
  animationTo?: TargetAndTransition | TargetAndTransition[];
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
}

export function BlurText({
  text = "",
  delay = 150,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing,
  onAnimationComplete,
  stepDuration = 0.35,
}: BlurTextProps) {
  const elements = useMemo(() => {
    return animateBy === "words" ? text.split(" ") : text.split("");
  }, [text, animateBy]);

  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom: TargetAndTransition =
    direction === "top"
      ? { filter: "blur(10px)", opacity: 0, transform: "translate3d(0,-30px,0)" }
      : { filter: "blur(10px)", opacity: 0, transform: "translate3d(0,30px,0)" };

  const defaultTo: TargetAndTransition = {
    filter: ["blur(10px)", "blur(4px)", "blur(0px)"],
    opacity: [0, 0.6, 1],
    transform:
      direction === "top"
        ? ["translate3d(0,-30px,0)", "translate3d(0,4px,0)", "translate3d(0,0px,0)"]
        : ["translate3d(0,30px,0)", "translate3d(0,-4px,0)", "translate3d(0,0px,0)"],
  };

  const from = animationFrom ?? defaultFrom;
  const to = animationTo ?? defaultTo;

  if (prefersReducedMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref} className={`blur-text ${className}`} style={{ display: "inline-flex", flexWrap: "wrap" }}>
      {elements.map((element, index) => (
        <motion.span
          key={index}
          initial={from}
          animate={(inView ? to : from) as TargetAndTransition}
          transition={{
            duration: stepDuration,
            delay: (index * delay) / 1000,
            ease: easing ?? [0.25, 0.1, 0.25, 1.0],
          }}
          onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          style={{
            display: "inline-block",
            willChange: "transform, filter, opacity",
          }}
        >
          {element === " " ? "\u00A0" : element}
          {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
        </motion.span>
      ))}
    </span>
  );
}
