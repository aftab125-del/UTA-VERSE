"use client";

import { useRef, useState, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, CSSProperties } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

const defaultSpringConfig = {
  damping: 24,
  stiffness: 140,
  mass: 0.45,
};

export interface TiltWrapperProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  rotateAmplitude?: number;
  scaleOnHover?: number;
  perspective?: number;
  disabled?: boolean;
  onClick?: () => void;
}

export function TiltWrapper({
  children,
  className = "",
  innerClassName = "",
  style = {},
  innerStyle = {},
  rotateAmplitude = 12,
  scaleOnHover = 1.04,
  perspective = 1200,
  disabled = false,
  onClick,
}: TiltWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionAllowed(!mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setMotionAllowed(!e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  const rotateX = useSpring(0, defaultSpringConfig);
  const rotateY = useSpring(0, defaultSpringConfig);
  const scale = useSpring(1, defaultSpringConfig);

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!ref.current || !motionAllowed || disabled) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotX);
    rotateY.set(rotY);
  }

  function handleMouseEnter() {
    if (!motionAllowed || disabled) return;
    scale.set(scaleOnHover);
  }

  function handleMouseLeave() {
    if (!motionAllowed || disabled) return;
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      ref={ref}
      className={`tilt-wrapper ${className}`.trim()}
      style={{
        perspective: `${perspective}px`,
        transformStyle: "preserve-3d",
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <motion.div
        className={`tilt-wrapper__inner ${innerClassName}`.trim()}
        style={{
          width: "100%",
          height: "100%",
          rotateX: motionAllowed && !disabled ? rotateX : 0,
          rotateY: motionAllowed && !disabled ? rotateY : 0,
          scale: motionAllowed && !disabled ? scale : 1,
          transformStyle: "preserve-3d",
          ...innerStyle,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default TiltWrapper;
