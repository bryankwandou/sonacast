import { useEffect, useState } from 'react';

const DEFAULT_ACCENT_RGB = '16, 185, 129';
const coverRgbCache = new Map<string, string>();

/**
 * Extracts primary artist name from multi-artist credits ("Artist A feat. Artist B").
 */
export function getPrimaryArtistName(artist?: string): string {
  const raw = (artist || '').trim();
  if (!raw) return 'Artist';
  return raw.split(/,|feat\.?|ft\.?|&|x\s/i)[0].trim() || raw;
}

/**
 * Deterministic pleasant emerald/cyan/slate-balanced RGB triplet for CORS-safe fallback.
 */
export function hashAccentRgb(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const palette = [
    '16, 185, 129', // Emerald
    '14, 165, 233', // Sky
    '20, 184, 166', // Teal
    '245, 158, 11', // Amber Gold
    '99, 102, 241', // Indigo
    '236, 72, 153', // Rose
    '34, 197, 94'   // Green
  ];
  return palette[hash % palette.length] || DEFAULT_ACCENT_RGB;
}

/**
 * Safely samples dominant color from cover art in a tiny offscreen canvas.
 * Falls back cleanly on cross-origin restrictions or missing images.
 */
export async function extractCoverAccentRgb(coverUrl?: string, seed = ''): Promise<string> {
  const cacheKey = coverUrl || seed;
  if (!cacheKey) return DEFAULT_ACCENT_RGB;
  const cached = coverRgbCache.get(cacheKey);
  if (cached) return cached;

  const fallback = hashAccentRgb(seed || cacheKey);
  if (!coverUrl || coverUrl.startsWith('data:image/svg') || typeof document === 'undefined') {
    coverRgbCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => reject(new Error('timeout')), 3500);
      image.onload = () => {
        window.clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('load failed'));
      };
      image.src = coverUrl;
    });

    const size = 20;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 180) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      // Prefer saturated mid-tone pixels over near-black or near-white extremes
      if (maxC < 25 || minC > 240) continue;
      const weight = maxC - minC > 30 ? 2 : 1;
      rTotal += r * weight;
      gTotal += g * weight;
      bTotal += b * weight;
      count += weight;
    }

    if (count === 0) {
      coverRgbCache.set(cacheKey, fallback);
      return fallback;
    }

    let rAvg = Math.round(rTotal / count);
    let gAvg = Math.round(gTotal / count);
    let bAvg = Math.round(bTotal / count);

    // Ensure sufficient luminance for atmospheric radial glow visibility
    const peak = Math.max(rAvg, gAvg, bAvg, 1);
    if (peak < 130) {
      const boost = 135 / peak;
      rAvg = Math.min(240, Math.round(rAvg * boost));
      gAvg = Math.min(240, Math.round(gAvg * boost));
      bAvg = Math.min(240, Math.round(bAvg * boost));
    }

    const rgb = `${rAvg}, ${gAvg}, ${bAvg}`;
    coverRgbCache.set(cacheKey, rgb);
    return rgb;
  } catch {
    coverRgbCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * React hook returning CSS RGB triplet ("r, g, b") sampled from active track art.
 * Avoids canvas work when lowCpuMode is enabled.
 */
export function useCoverAccentRgb(
  coverUrl?: string,
  title?: string,
  artist?: string,
  lowCpuMode = false
): string {
  const seed = `${title || ''}|${artist || ''}`;
  const cacheKey = coverUrl || seed;
  const deterministic = hashAccentRgb(seed);
  const [sampled, setSampled] = useState<{ key: string; rgb: string } | null>(null);

  useEffect(() => {
    if (lowCpuMode || !coverUrl || coverRgbCache.has(cacheKey)) return;
    let active = true;
    void extractCoverAccentRgb(coverUrl, seed).then((rgb) => {
      if (active) setSampled({ key: cacheKey, rgb });
    });
    return () => {
      active = false;
    };
  }, [coverUrl, seed, cacheKey, lowCpuMode]);

  if (lowCpuMode) return deterministic;
  if (sampled && sampled.key === cacheKey) return sampled.rgb;
  return coverRgbCache.get(cacheKey) || deterministic;
}
