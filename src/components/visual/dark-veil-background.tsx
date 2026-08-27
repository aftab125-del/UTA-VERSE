"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { DarkVeilProps } from "@/components/reactbits/DarkVeil";

const DarkVeil = dynamic(
  () => import("@/components/reactbits/DarkVeil").then((mod) => mod.DarkVeil),
  { ssr: false }
) as ComponentType<DarkVeilProps>;

export function DarkVeilBackground() {
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionAllowed(!mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setMotionAllowed(!e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  if (!motionAllowed) {
    return <div className="dark-veil-wrapper dark-veil-wrapper--static" aria-hidden="true" />;
  }

  return (
    <div className="dark-veil-wrapper" aria-hidden="true">
      <DarkVeil
        hueShift={0.0}
        noiseIntensity={0.15}
        scanlineIntensity={0}
        speed={0.3}
        warpAmount={0.3}
      />
    </div>
  );
}
