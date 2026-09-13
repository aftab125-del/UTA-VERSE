export interface ThemePalette {
  dominant: string;
  dominantHex: string;
  accent: string;
  colors: string[];
  secondaryHex?: string;
  backgroundGradient: string;
  mobileBackgroundGradient: string;
  glowColor: string;
}

export const DEFAULT_PALETTE: ThemePalette = {
  dominant: "rgb(139, 92, 246)",
  dominantHex: "#8b5cf6",
  accent: "rgb(216, 204, 255)",
  colors: [
    "rgb(139, 92, 246)",
    "rgb(224, 60, 244)",
    "rgb(59, 130, 246)",
    "rgb(30, 27, 75)",
  ],
  secondaryHex: "#e03cf4",
  backgroundGradient:
    "radial-gradient(ellipse 80% 55% at 15% 15%, rgba(139, 92, 246, 0.50) 0%, transparent 68%), radial-gradient(ellipse 70% 60% at 85% 20%, rgba(224, 60, 244, 0.42) 0%, transparent 65%), radial-gradient(ellipse 65% 55% at 50% 85%, rgba(59, 130, 246, 0.35) 0%, transparent 70%), radial-gradient(ellipse 55% 45% at 80% 80%, rgba(30, 27, 75, 0.28) 0%, transparent 65%), #06070a",
  mobileBackgroundGradient:
    "radial-gradient(circle at 85% 18%, rgba(224, 60, 244, 0.45) 0%, transparent 55%), linear-gradient(180deg, rgba(139, 92, 246, 0.78) 0%, rgba(224, 60, 244, 0.48) 35%, rgba(59, 130, 246, 0.28) 68%, #06070a 100%)",
  glowColor: "rgba(139, 92, 246, 0.45)",
};

const paletteCache = new Map<string, ThemePalette>();

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  if (max === 0) return 0;
  return delta / max;
}

function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case nr:
        h = (ng - nb) / d + (ng < nb ? 6 : 0);
        break;
      case ng:
        h = (nb - nr) / d + 2;
        break;
      case nb:
        h = (nr - ng) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGBColor {
  const normH = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (normH < 60) {
    [r, g, b] = [c, x, 0];
  } else if (normH < 120) {
    [r, g, b] = [x, c, 0];
  } else if (normH < 180) {
    [r, g, b] = [0, c, x];
  } else if (normH < 240) {
    [r, g, b] = [0, x, c];
  } else if (normH < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Weighted Euclidean distance in RGB approximating human vision sensitivity
 */
function colorDistance(c1: RGBColor, c2: RGBColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * Extracts multiple dominant colors (top 3-4 via clustering) and blends into
 * a rich multi-point dynamic radial mesh gradient for desktop and multi-stop
 * linear/radial blend for mobile.
 */
export async function extractThemePalette(imageUrl?: string | null): Promise<ThemePalette> {
  if (!imageUrl || typeof window === "undefined") {
    return DEFAULT_PALETTE;
  }

  const cached = paletteCache.get(imageUrl);
  if (cached) return cached;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Use artwork proxy for remote images to avoid CORS security errors with external CDNs
    const proxyUrl = imageUrl.startsWith("http")
      ? `/api/artwork-proxy?url=${encodeURIComponent(imageUrl)}`
      : imageUrl;
    img.src = proxyUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load error"));
      setTimeout(() => reject(new Error("Image load timeout")), 3500);
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return DEFAULT_PALETTE;

    const sampleSize = 36;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorBuckets = new Map<
      string,
      { r: number; g: number; b: number; count: number; sat: number; score: number }
    >();

    let totalBrightness = 0;
    let validPixels = 0;

    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];

      if (a < 128) continue; // Skip transparent

      const brightness = getBrightness(r, g, b);
      totalBrightness += brightness;
      validPixels++;

      // Skip extreme darks and extreme whites
      if (brightness < 25 || brightness > 245) continue;

      const sat = getSaturation(r, g, b);
      // Allow warm tans, pastels, and subtle colors (sat >= 0.06)
      if (sat < 0.06) continue;

      // Quantize
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      const key = `${qr},${qg},${qb}`;

      const existing = colorBuckets.get(key);
      const isWarm = qr > qb && (qr > 85 || qg > 70);
      const score = sat * 2.8 + (brightness / 255) + (isWarm ? 0.35 : 0);

      if (existing) {
        existing.count += 1;
        existing.score += score;
      } else {
        colorBuckets.set(key, { r: qr, g: qg, b: qb, count: 1, sat, score });
      }
    }

    const selectedColors: RGBColor[] = [];

    if (colorBuckets.size > 0) {
      // 1. Sort candidate buckets by weighted vibrancy score
      const sortedBuckets = Array.from(colorBuckets.values()).sort((a, b) => {
        const scoreA = a.score * Math.sqrt(a.count);
        const scoreB = b.score * Math.sqrt(b.count);
        return scoreB - scoreA;
      });

      // Primary clustering pass: distinct color separation
      const PRIMARY_DISTANCE = 68;
      for (const bucket of sortedBuckets) {
        if (selectedColors.length >= 4) break;
        const candidate: RGBColor = { r: bucket.r, g: bucket.g, b: bucket.b };
        const isDistinct = selectedColors.every((sel) => colorDistance(sel, candidate) >= PRIMARY_DISTANCE);
        if (isDistinct) {
          selectedColors.push(candidate);
        }
      }

      // Secondary pass if fewer than 4 distinct clusters found
      if (selectedColors.length < 4) {
        const SECONDARY_DISTANCE = 48;
        for (const bucket of sortedBuckets) {
          if (selectedColors.length >= 4) break;
          const candidate: RGBColor = { r: bucket.r, g: bucket.g, b: bucket.b };
          const isDistinct = selectedColors.every((sel) => colorDistance(sel, candidate) >= SECONDARY_DISTANCE);
          if (isDistinct) {
            selectedColors.push(candidate);
          }
        }
      }

      // If still fewer than 4 (e.g. monochromatic or bi-color artwork), synthesize harmonious analogous tones
      const c1 = selectedColors[0];
      const [h1, s1, l1] = rgbToHsl(c1.r, c1.g, c1.b);

      if (selectedColors.length === 1) {
        selectedColors.push(
          hslToRgb(h1 + 35, Math.max(0.4, s1 * 0.95), Math.min(0.65, Math.max(0.35, l1 * 0.92))),
          hslToRgb(h1 - 35, Math.max(0.4, s1 * 0.9), Math.min(0.6, Math.max(0.3, l1 * 0.85))),
          {
            r: Math.max(16, Math.round(c1.r * 0.32)),
            g: Math.max(16, Math.round(c1.g * 0.32)),
            b: Math.max(20, Math.round(c1.b * 0.32)),
          }
        );
      } else if (selectedColors.length === 2) {
        const c2 = selectedColors[1];
        const [h2, s2, l2] = rgbToHsl(c2.r, c2.g, c2.b);
        selectedColors.push(
          hslToRgb(h2 + 25, Math.max(0.35, s2 * 0.88), Math.min(0.6, Math.max(0.3, l2 * 0.85))),
          {
            r: Math.max(14, Math.round(c1.r * 0.22 + c2.r * 0.22)),
            g: Math.max(14, Math.round(c1.g * 0.22 + c2.g * 0.22)),
            b: Math.max(18, Math.round(c1.b * 0.22 + c2.b * 0.22)),
          }
        );
      } else if (selectedColors.length === 3) {
        const c1Ref = selectedColors[0];
        const c3Ref = selectedColors[2];
        selectedColors.push({
          r: Math.max(14, Math.round(c1Ref.r * 0.2 + c3Ref.r * 0.2)),
          g: Math.max(14, Math.round(c1Ref.g * 0.2 + c3Ref.g * 0.2)),
          b: Math.max(18, Math.round(c1Ref.b * 0.2 + c3Ref.b * 0.2)),
        });
      }
    } else {
      // 2. Monochrome / Black & White cover:
      // Produce cinematic moody silver/slate theme rather than flat default
      const avgBrightness = validPixels > 0 ? totalBrightness / validPixels : 100;
      if (avgBrightness > 125) {
        selectedColors.push(
          { r: 100, g: 116, b: 139 }, // slate-500
          { r: 71, g: 85, b: 105 },   // slate-600
          { r: 51, g: 65, b: 85 },   // slate-700
          { r: 30, g: 41, b: 59 }    // slate-800
        );
      } else {
        selectedColors.push(
          { r: 71, g: 85, b: 105 },   // slate-600
          { r: 51, g: 65, b: 85 },   // slate-700
          { r: 30, g: 41, b: 59 },   // slate-800
          { r: 15, g: 23, b: 42 }    // slate-900
        );
      }
    }

    const [c1, c2, c3, c4] = selectedColors;
    const hex = rgbToHex(c1.r, c1.g, c1.b);
    const secondaryHex = rgbToHex(c2.r, c2.g, c2.b);

    const isMonochrome = colorBuckets.size === 0;
    const accent = isMonochrome
      ? "rgb(241, 245, 249)" // crisp white-silver for B&W covers
      : `rgb(${Math.min(255, Math.round(c1.r * 1.35 + 25))}, ${Math.min(255, Math.round(c1.g * 1.35 + 25))}, ${Math.min(255, Math.round(c1.b * 1.35 + 25))})`;

    // Rich dynamic multi-point radial mesh gradient for desktop
    const backgroundGradient = [
      `radial-gradient(ellipse 80% 55% at 15% 15%, rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.50) 0%, transparent 68%)`,
      `radial-gradient(ellipse 70% 60% at 85% 20%, rgba(${c2.r}, ${c2.g}, ${c2.b}, 0.42) 0%, transparent 65%)`,
      `radial-gradient(ellipse 65% 55% at 50% 85%, rgba(${c3.r}, ${c3.g}, ${c3.b}, 0.35) 0%, transparent 70%)`,
      `radial-gradient(ellipse 55% 45% at 80% 80%, rgba(${c4.r}, ${c4.g}, ${c4.b}, 0.28) 0%, transparent 65%)`,
      "#06070a",
    ].join(", ");

    // Multi-stop linear + radial accent blend for mobile
    const mobileBackgroundGradient = [
      `radial-gradient(circle at 85% 18%, rgba(${c2.r}, ${c2.g}, ${c2.b}, 0.45) 0%, transparent 55%)`,
      `linear-gradient(180deg, rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.78) 0%, rgba(${c2.r}, ${c2.g}, ${c2.b}, 0.48) 35%, rgba(${c3.r}, ${c3.g}, ${c3.b}, 0.28) 68%, #06070a 100%)`,
    ].join(", ");

    const palette: ThemePalette = {
      dominant: `rgb(${c1.r}, ${c1.g}, ${c1.b})`,
      dominantHex: hex,
      secondaryHex,
      accent,
      colors: selectedColors.map((c) => `rgb(${c.r}, ${c.g}, ${c.b})`),
      backgroundGradient,
      mobileBackgroundGradient,
      glowColor: `rgba(${c1.r}, ${c1.g}, ${c1.b}, 0.45)`,
    };

    paletteCache.set(imageUrl, palette);
    return palette;
  } catch {
    return DEFAULT_PALETTE;
  }
}
