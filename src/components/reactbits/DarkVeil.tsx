"use client";

import { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import "./DarkVeil.css";

export interface DarkVeilProps {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  speed?: number;
  warpAmount?: number;
  className?: string;
}

const vert = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uHueShift;
  uniform float uNoiseIntensity;
  uniform float uScanlineIntensity;
  uniform float uSpeed;
  uniform float uWarpAmount;
  varying vec2 vUv;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ) );
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / uResolution.xy;
    float time = uTime * uSpeed;

    vec2 q = vec2(0.0);
    q.x = snoise(st + vec2(time * 0.1, time * 0.12));
    q.y = snoise(st + vec2(time * 0.13, time * 0.08));

    vec2 r = vec2(0.0);
    r.x = snoise(st + uWarpAmount * q + vec2(1.7, 9.2) + 0.15 * time);
    r.y = snoise(st + uWarpAmount * q + vec2(8.3, 2.8) + 0.126 * time);

    float f = snoise(st + r);

    // Deep purple / violet base theme
    vec3 baseColor = vec3(0.04, 0.02, 0.08);
    vec3 accentColor = vec3(0.24, 0.12, 0.42);
    vec3 highlightColor = vec3(0.42, 0.22, 0.68);

    vec3 color = mix(baseColor, accentColor, clamp(f * f * 4.0, 0.0, 1.0));
    color = mix(color, highlightColor, clamp(length(q), 0.0, 1.0) * 0.35);

    // Apply hue shift
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + uHueShift);
    color = hsv2rgb(hsv);

    // Noise & scanlines
    float noise = (random(st + time) - 0.5) * uNoiseIntensity;
    color += noise;

    if (uScanlineIntensity > 0.0) {
      float scanline = sin(st.y * uResolution.y * 1.5) * uScanlineIntensity;
      color -= scanline;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function DarkVeil({
  hueShift = 0.0,
  noiseIntensity = 0.02,
  scanlineIntensity = 0.0,
  speed = 0.3,
  warpAmount = 0.05,
  className = "",
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionAllowed(!mediaQuery.matches);
    const updateMotion = (e: MediaQueryListEvent) => setMotionAllowed(!e.matches);
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !motionAllowed) return;

    let renderer: Renderer | null = null;
    let animationFrameId: number;

    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
        antialias: false,
      });
      const gl = renderer.gl;
      container.appendChild(gl.canvas);
      gl.canvas.classList.add("dark-veil-canvas");

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [container.clientWidth, container.clientHeight] },
          uHueShift: { value: hueShift },
          uNoiseIntensity: { value: noiseIntensity },
          uScanlineIntensity: { value: scanlineIntensity },
          uSpeed: { value: speed },
          uWarpAmount: { value: warpAmount },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });

      function resize() {
        if (!container || !renderer) return;
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [width, height];
      }

      window.addEventListener("resize", resize);
      resize();

      const startTime = performance.now();

      function update(t: number) {
        animationFrameId = requestAnimationFrame(update);
        program.uniforms.uTime.value = (t - startTime) * 0.001;
        if (renderer) renderer.render({ scene: mesh });
      }

      animationFrameId = requestAnimationFrame(update);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", resize);
        if (gl.canvas.parentElement) {
          gl.canvas.parentElement.removeChild(gl.canvas);
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      // Fallback gracefully if WebGL fails
      return;
    }
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, warpAmount, motionAllowed]);

  if (!motionAllowed) {
    return <div className={`dark-veil-container dark-veil-container--static ${className}`} aria-hidden="true" />;
  }

  return <div ref={containerRef} className={`dark-veil-container ${className}`} aria-hidden="true" />;
}
