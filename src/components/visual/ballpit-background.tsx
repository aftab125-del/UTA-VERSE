"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";

interface BallpitProps {
  count: number;
  gravity: number;
  friction: number;
  wallBounce: number;
  followCursor: boolean;
}

const Ballpit = dynamic(() => import("@/components/reactbits/Ballpit.jsx"), {
  ssr: false,
}) as ComponentType<BallpitProps>;

export function BallpitBackground() {
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setMotionAllowed(!mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  if (!motionAllowed) {
    return <div className="ballpit-background ballpit-background--static" aria-hidden="true" />;
  }

  return (
    <div className="ballpit-background" aria-hidden="true">
      <Ballpit
        count={200}
        gravity={0.7}
        friction={0.8}
        wallBounce={0.95}
        followCursor={true}
      />
    </div>
  );
}
