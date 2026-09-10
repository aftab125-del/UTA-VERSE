export interface ThemePalette {
  dominant: string;
  dominantHex: string;
  accent: string;
  backgroundGradient: string;
  mobileBackgroundGradient: string;
  glowColor: string;
}

const DEFAULT_PALETTE: ThemePalette = {
  dominant: "rgb(139, 92, 246)",
  dominantHex: "#8b5cf6",
  accent: "rgb(216, 204, 255)",
  backgroundGradient:
    "radial-gradient(ellipse 90% 60% at 50% -15%, rgba(139, 92, 246, 0.5) 0%, rgba(20, 18, 35, 0.6) 60%, #06070a 90%), #06070a",
  mobileBackgroundGradient:
    "linear-gradient(180deg, rgb(95, 62, 168) 0%, rgb(48, 31, 85) 42%, rgb(22, 14, 40) 100%)",
  glowColor: "rgba(139, 92, 246, 0.4)",
};

const paletteCache = new Map<string, ThemePalette>();

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

/**
 * Extracts a dominant, vibrant theme palette from an image URL.
 * Handles both colorful artworks and monochrome/B&W covers cleanly.
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
    const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number; sat: number; score: number }>();

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

    let r = 139;
    let g = 92;
    let b = 246;

    if (colorBuckets.size > 0) {
      // 1. Colorful/warm image: pick highest scoring vibrant color
      let highestScore = -1;
      for (const bucket of colorBuckets.values()) {
        const totalScore = bucket.score * Math.sqrt(bucket.count);
        if (totalScore > highestScore) {
          highestScore = totalScore;
          r = bucket.r;
          g = bucket.g;
          b = bucket.b;
        }
      }
    } else {
      // 2. Monochrome / Black & White cover:
      // Produce a cinematic moody silver/slate theme rather than random purple
      const avgBrightness = validPixels > 0 ? totalBrightness / validPixels : 100;
      if (avgBrightness > 130) {
        r = 100;
        g = 116;
        b = 139; // slate-500
      } else {
        r = 71;
        g = 85;
        b = 105; // slate-600
      }
    }

    const hex = rgbToHex(r, g, b);

    // Accent: crisp, high-contrast readable color for lyrics & active elements
    const isMonochrome = colorBuckets.size === 0;
    const accent = isMonochrome
      ? "rgb(241, 245, 249)" // crisp white-silver for B&W covers
      : `rgb(${Math.min(255, Math.round(r * 1.35 + 25))}, ${Math.min(255, Math.round(g * 1.35 + 25))}, ${Math.min(255, Math.round(b * 1.35 + 25))})`;

    // Rich atmospheric mobile gradient (continuous from top to bottom, exactly matching reference picture)
    const topR = Math.min(255, Math.round(r * 0.72));
    const topG = Math.min(255, Math.round(g * 0.72));
    const topB = Math.min(255, Math.round(b * 0.72));

    const midR = Math.max(22, Math.round(r * 0.38));
    const midG = Math.max(22, Math.round(g * 0.38));
    const midB = Math.max(24, Math.round(b * 0.38));

    const botR = Math.max(14, Math.round(r * 0.18));
    const botG = Math.max(14, Math.round(g * 0.18));
    const botB = Math.max(18, Math.round(b * 0.18));

    const mobileBackgroundGradient = `linear-gradient(180deg, rgb(${topR}, ${topG}, ${topB}) 0%, rgb(${midR}, ${midG}, ${midB}) 42%, rgb(${botR}, ${botG}, ${botB}) 100%)`;

    const palette: ThemePalette = {
      dominant: `rgb(${r}, ${g}, ${b})`,
      dominantHex: hex,
      accent,
      // Desktop ambient radial glow
      backgroundGradient: `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${r}, ${g}, ${b}, 0.5) 0%, rgba(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)}, 0.4) 60%, #06070a 90%), #06070a`,
      mobileBackgroundGradient,
      glowColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
    };

    paletteCache.set(imageUrl, palette);
    return palette;
  } catch {
    return DEFAULT_PALETTE;
  }
}
