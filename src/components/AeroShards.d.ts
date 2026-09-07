import type { ComponentType } from "react";

export interface AeroShardsProps {
  backgroundColor?: string;
  shardColor?: string;
  accentColor?: string;
  placement?: "right" | "left" | "center" | "full" | string;
  flow?: "stream" | "vortex" | "ribbon" | string;
  material?: "pearl" | "chrome" | "satin" | string;
  detail?: "bold" | "balanced" | "fine" | string;
  effect?: "none" | "dither" | "ascii" | string;
  scale?: number;
  spread?: number;
  depth?: number;
  speed?: number;
  spin?: number;
  interaction?: "none" | "repel" | "attract" | string;
  density?: number;
  shardSize?: number;
  stretch?: number;
  turbulence?: number;
  glow?: number;
  edgeSoftness?: number;
  bloom?: number;
  grain?: number;
  chromaticAberration?: number;
  transitionDuration?: number;
  interactionRadius?: number;
  interactionStrength?: number;
  rippleIntensity?: number;
  holdToGather?: boolean;
  paused?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

declare const AeroShards: ComponentType<AeroShardsProps>;
export default AeroShards;
