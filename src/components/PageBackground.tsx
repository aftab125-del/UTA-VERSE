"use client";

import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";
import AeroShards from "@/components/AeroShards";

export function PageBackground() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // On mobile (<768px), render a plain, lightweight near-black solid background on all pages.
  // This bypasses WebGPU and AeroShards/Ballpit completely for performance and simplicity.
  if (isMobile) {
    return (
      <div
        className="mobile-plain-bg"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#0a0b10",
        }}
        aria-hidden="true"
      />
    );
  }

  // On desktop, do not render AeroShards on the Home page (desktop Home uses Ballpit).
  if (pathname === "/") {
    return null;
  }

  return (
    <div
      className="aero-shards-bg-wrapper"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <AeroShards
        backgroundColor="#120F17"
        shardColor="#896ABD"
        accentColor="#A855F7"
        placement="full"
        flow="stream"
        material="pearl"
        interaction="repel"
        onError={(error) => {
          console.warn("[PageBackground] AeroShards WebGPU error:", error);
        }}
      />
    </div>
  );
}
