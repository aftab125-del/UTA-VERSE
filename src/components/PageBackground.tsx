"use client";

import { usePathname } from "next/navigation";
import AeroShards from "@/components/AeroShards";

export function PageBackground() {
  const pathname = usePathname();

  // Do not render on the Home page
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
