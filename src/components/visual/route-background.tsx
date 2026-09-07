"use client";

import { usePathname } from "next/navigation";
import { BallpitBackground } from "@/components/visual/ballpit-background";
import { DarkVeilBackground } from "@/components/visual/dark-veil-background";

export function RouteBackground() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return <BallpitBackground key="ballpit-home-bg" />;
  }

  return null;
}
