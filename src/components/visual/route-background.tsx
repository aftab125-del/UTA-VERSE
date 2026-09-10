"use client";

import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { BallpitBackground } from "@/components/visual/ballpit-background";

export function RouteBackground() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const isHome = pathname === "/";

  // Ballpit is exclusive to desktop Home. On mobile, a plain near-black background is rendered via PageBackground.
  if (isHome && !isMobile) {
    return <BallpitBackground key="ballpit-home-bg" />;
  }

  return null;
}
