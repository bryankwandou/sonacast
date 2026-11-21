import React, { useEffect, useRef, useState } from 'react';
import { sharedAudioEngine } from '../../services/audioEngine';
import type { LyricLine } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { buildCoverFallbackDataUri } from '../../utils/coverFallback';
import { Maximize2, Minimize2, Sparkles, Sliders } from 'lucide-react';

interface OrbwaveCanvasProps {
  coverUrl: string;
  title: string;
  artist: string;
  lyrics: LyricLine[];
  currentTime: number;
  palette?: 'emerald' | 'cyber' | 'amber' | 'ice';
  showLyricsOverlay?: boolean;
  lowCpuMode?: boolean;
  isPlaying?: boolean;
}

const PALETTES = {
  emerald: {
    primary: '#10B981',
    secondary: '#06B6D4',
    glow: 'rgba(16, 185, 129, 0.48)',
    ribbonFill: 'rgba(16, 185, 129, 0.16)',
    ribbonStroke: 'rgba(52, 211, 153, 0.85)',
    ribbonAlt: 'rgba(6, 182, 212, 0.62)',
    accent: '#34D399'
  },
  cyber: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    glow: 'rgba(139, 92, 246, 0.48)',
    ribbonFill: 'rgba(139, 92, 246, 0.17)',
    ribbonStroke: 'rgba(244, 114, 182, 0.88)',
    ribbonAlt: 'rgba(167, 139, 250, 0.62)',
    accent: '#F472B6'
  },
  amber: {
    primary: '#F59E0B',
    secondary: '#EF4444',
    glow: 'rgba(245, 158, 11, 0.48)',
    ribbonFill: 'rgba(245, 158, 11, 0.16)',
    ribbonStroke: 'rgba(251, 191, 36, 0.88)',
    ribbonAlt: 'rgba(239, 68, 68, 0.6)',
    accent: '#FBBF24'
  },
  ice: {
    primary: '#38BDF8',
    secondary: '#818CF8',
    glow: 'rgba(56, 189, 248, 0.48)',
    ribbonFill: 'rgba(56, 189, 248, 0.16)',
    ribbonStroke: 'rgba(96, 165, 250, 0.88)',
    ribbonAlt: 'rgba(129, 140, 248, 0.62)',
    accent: '#60A5FA'
  }
};

interface PulseRing {
  radius: number;
  alpha: number;
  speed: number;
}

export const OrbwaveCanvas: React.FC<OrbwaveCanvasProps> = ({
  coverUrl,
  title,
  artist,
  lyrics,
  currentTime,
  palette = 'emerald',
  showLyricsOverlay = true,
  lowCpuMode = false,
  isPlaying = true
}) => {
  const { theme } = useAppPreferences();
  const isLight = theme === 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [paletteOverride, setPaletteOverride] = useState<{
    base: 'emerald' | 'cyber' | 'amber' | 'ice';
    value: 'emerald' | 'cyber' | 'amber' | 'ice';
  } | null>(null);
  const selectedPalette =
    paletteOverride && paletteOverride.base === palette ? paletteOverride.value : palette;
  const setSelectedPalette = (next: 'emerald' | 'cyber' | 'amber' | 'ice') =>
    setPaletteOverride({ base: palette, value: next });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [barStyle, setBarStyle] = useState<'ring' | 'spikes' | 'wave'>('ring');

  const coverImageRef = useRef<HTMLImageElement | null>(null);

  // Preload cover image cleanly on track change
  useEffect(() => {
    let cancelled = false;
    coverImageRef.current = null;

    const loadFallback = () => {
      if (cancelled) return;
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        if (!cancelled) {
          coverImageRef.current = fallbackImg;
        }
      };
      fallbackImg.src = buildCoverFallbackDataUri(title, artist);
    };

    if (!coverUrl) {
      loadFallback();
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        coverImageRef.current = img;
      }
    };
    img.onerror = loadFallback;
    img.src = coverUrl;

    return () => {
      cancelled = true;
    };
  }, [coverUrl, title, artist]);

  // Keep reactive visual props inside refs so the single rAF loop never resets or stalls
  const activeLyric = lyrics.slice().reverse().find((l) => currentTime >= l.time) || lyrics[0];
  const nextLyric = lyrics.find((l) => l.time > currentTime);
  const activeLyricRef = useRef<LyricLine | undefined>(activeLyric);
  const nextLyricRef = useRef<LyricLine | undefined>(nextLyric);
  const showLyricsOverlayRef = useRef<boolean>(showLyricsOverlay);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const lowCpuModeRef = useRef<boolean>(lowCpuMode);
  const paletteRef = useRef<'emerald' | 'cyber' | 'amber' | 'ice'>(selectedPalette);
  const barStyleRef = useRef<'ring' | 'spikes' | 'wave'>(barStyle);
  const isLightRef = useRef<boolean>(isLight);

  useEffect(() => {
    activeLyricRef.current = activeLyric;
    nextLyricRef.current = nextLyric;
    showLyricsOverlayRef.current = showLyricsOverlay;
    isPlayingRef.current = isPlaying;
    lowCpuModeRef.current = lowCpuMode;
    paletteRef.current = selectedPalette;
    barStyleRef.current = barStyle;
    isLightRef.current = isLight;
  }, [activeLyric, nextLyric, showLyricsOverlay, isPlaying, lowCpuMode, selectedPalette, barStyle, isLight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId = 0;
    let rotationAngle = 0;
    let wavePhase = 0;
    let lastFrameTs = 0;
    let frameCount = 0;
    let lastPulseSpawnTs = 0;

    const numBars = 72;
    const smoothedBars = new Float32Array(numBars);
    const smoothedWave = new Float32Array(128);
    let smoothedBass = 0;
    let smoothedMid = 0;
    let smoothedTreble = 0;
    let smoothedLevel = 0;
    const pulseRings: PulseRing[] = [];

    // Deterministic ambient particle field
    const particles = Array.from({ length: 48 }, (_, i) => ({
      x: Math.sin(i * 99) * 0.5 + 0.5,
      y: Math.cos(i * 33) * 0.5 + 0.5,
      size: (i % 3) + 1.2,
      speed: (i % 5) * 0.00035 + 0.00025,
      opacity: (i % 7) * 0.1 + 0.28
    }));

    const drawClosedSmoothRing = (points: { x: number; y: number }[]) => {
      if (points.length < 3) return;
      ctx.beginPath();
      const last = points[points.length - 1];
      const first = points[0];
      ctx.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);
      for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];
        const midX = (curr.x + next.x) * 0.5;
        const midY = (curr.y + next.y) * 0.5;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      ctx.closePath();
    };

    const drawFrame = (ts: number) => {
      const width = canvas.width;
      const height = canvas.height;
      if (width <= 0 || height <= 0) return;

      const centerX = width / 2;
      const centerY = height / 2;
      const minDimension = Math.min(width, height);
      const baseRadius = minDimension * 0.21;
      const isLightNow = isLightRef.current;
      const colors = PALETTES[paletteRef.current];
      const styleMode = barStyleRef.current;
      const livePlaying = isPlayingRef.current || sharedAudioEngine.getIsPlaying();
      const tSec = ts * 0.001;

      const spectrum = livePlaying ? sharedAudioEngine.getSpectrum() : null;
      const targetBass = spectrum ? spectrum.bass : 0.08 + Math.sin(tSec * 1.4) * 0.03;
      const targetMid = spectrum ? spectrum.mid : 0.07 + Math.cos(tSec * 1.8) * 0.025;
      const targetTreble = spectrum ? spectrum.treble : 0.05 + Math.sin(tSec * 2.3) * 0.02;
      const targetLevel = spectrum ? spectrum.level : 0.07 + Math.sin(tSec * 1.5) * 0.025;

      // Fast attack, silky release energy envelopes
      smoothedBass += (targetBass - smoothedBass) * (targetBass > smoothedBass ? 0.42 : 0.16);
      smoothedMid += (targetMid - smoothedMid) * (targetMid > smoothedMid ? 0.38 : 0.15);
      smoothedTreble += (targetTreble - smoothedTreble) * (targetTreble > smoothedTreble ? 0.38 : 0.16);
      smoothedLevel += (targetLevel - smoothedLevel) * (targetLevel > smoothedLevel ? 0.4 : 0.16);

      wavePhase += livePlaying ? 0.055 + smoothedBass * 0.085 : 0.018;
      rotationAngle += livePlaying ? 0.0055 + smoothedBass * 0.012 : 0.0012;

      // Smooth frequency bar & waveform buffers
      const freqLen = spectrum?.frequencies?.length || 0;
      const waveLen = spectrum?.waveformData?.length || 0;

      for (let i = 0; i < numBars; i++) {
        let targetVal = 0;
        if (livePlaying && spectrum && freqLen > 0) {
          const logIdx = Math.min(
            freqLen - 1,
            Math.floor(Math.pow(i / numBars, 1.35) * (freqLen * 0.78))
          );
          targetVal = (spectrum.frequencies[logIdx] || 0) / 255;
        } else {
          // Gentle living idle breathing wave even before Play is clicked
          targetVal =
            0.09 +
            0.06 * Math.sin(wavePhase * 1.4 + (i / numBars) * Math.PI * 6) +
            0.04 * Math.cos(wavePhase * 0.9 - (i / numBars) * Math.PI * 4);
        }
        const alpha = targetVal > smoothedBars[i] ? 0.44 : 0.18;
        smoothedBars[i] += (targetVal - smoothedBars[i]) * alpha;
      }

      for (let i = 0; i < smoothedWave.length; i++) {
        let sample = 0;
        if (livePlaying && spectrum && waveLen > 0) {
          const idx = Math.floor((i / smoothedWave.length) * waveLen);
          sample = ((spectrum.waveformData[idx] ?? 128) - 128) / 128;
        } else {
          const frac = i / smoothedWave.length;
          sample =
            Math.sin(wavePhase * 1.6 + frac * Math.PI * 4) * 0.16 +
            Math.cos(wavePhase * 2.2 - frac * Math.PI * 6) * 0.08;
        }
        smoothedWave[i] += (sample - smoothedWave[i]) * 0.35;
      }

      // Spawn expanding bass shockwave ring on energetic beats
      if (livePlaying && smoothedBass > 0.32 && ts - lastPulseSpawnTs > 360) {
        lastPulseSpawnTs = ts;
        pulseRings.push({
          radius: baseRadius * 1.05,
          alpha: Math.min(0.65, 0.28 + smoothedBass * 0.45),
          speed: minDimension * (0.0045 + smoothedBass * 0.0045)
        });
        if (pulseRings.length > 6) pulseRings.shift();
      }

      // 1. Background radial gradient
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.35,
        centerX,
        centerY,
        minDimension * 0.82
      );
      if (isLightNow) {
        bgGrad.addColorStop(0, '#FFFFFF');
        bgGrad.addColorStop(0.58, '#ECF5F1');
        bgGrad.addColorStop(1, '#DCE7E3');
      } else {
        bgGrad.addColorStop(0, '#101828');
        bgGrad.addColorStop(0.58, '#080B12');
        bgGrad.addColorStop(1, '#040508');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Live Full-Width Horizontal Oscilloscope Soundwave Ribbons behind the Orb
      const drawHorizontalRibbon = (
        ampScale: number,
        phaseShift: number,
        strokeColor: string,
        fillColor: string | null,
        lineW: number
      ) => {
        const pts = smoothedWave.length;
        const maxAmp = height * (livePlaying ? 0.15 + smoothedLevel * 0.16 : 0.055) * ampScale;
        ctx.beginPath();
        for (let i = 0; i < pts; i++) {
          const frac = i / (pts - 1);
          const x = frac * width;
          // Smooth edge taper so wave glides cleanly into left/right frame edges
          const envelope = Math.sin(frac * Math.PI);
          const carrier = Math.sin(wavePhase * 1.35 + frac * Math.PI * 5 + phaseShift) * 0.35;
          const y = centerY + (smoothedWave[i] * 0.85 + carrier * (0.25 + smoothedMid)) * maxAmp * envelope;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineW;
        ctx.lineJoin = 'round';
        ctx.stroke();

        if (fillColor) {
          ctx.lineTo(width, centerY);
          ctx.lineTo(0, centerY);
          ctx.closePath();
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
      };

      drawHorizontalRibbon(1.0, 0, colors.ribbonStroke, colors.ribbonFill, 2.4);
      drawHorizontalRibbon(0.74, Math.PI * 0.65, colors.ribbonAlt, null, 1.7);

      // 3. Drifting ambient particles reacting to energy
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.speed * (livePlaying ? 1.4 + smoothedLevel * 4.2 : 0.5);
        if (p.y < 0) p.y = 1;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size * (1 + smoothedBass * 0.85), 0, Math.PI * 2);
        ctx.fillStyle = isLightNow
          ? `rgba(5, 150, 105, ${p.opacity * (0.28 + smoothedLevel * 0.55)})`
          : `rgba(255, 255, 255, ${p.opacity * (0.35 + smoothedLevel * 0.65)})`;
        ctx.fill();
      }

      // 4. Expanding bass shockwave ripples
      for (let i = pulseRings.length - 1; i >= 0; i--) {
        const ring = pulseRings[i];
        ring.radius += ring.speed;
        ring.alpha *= 0.962;
        if (ring.alpha < 0.02 || ring.radius > minDimension * 0.68) {
          pulseRings.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = colors.primary;
        ctx.globalAlpha = ring.alpha;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 5. Ambient glow behind orb reacting dynamically to bass
      const glowRadius = (baseRadius + 46) * (1 + smoothedBass * 0.36);
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.65,
        centerX,
        centerY,
        glowRadius
      );
      ambientGlow.addColorStop(0, colors.glow);
      ambientGlow.addColorStop(0.68, 'rgba(0, 0, 0, 0.04)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 6. Circular Liquid Wave Halo + Frequency Visualizer (Ring / Wave / Spikes)
      const angleStep = (Math.PI * 2) / numBars;
      ctx.save();
      ctx.translate(centerX, centerY);

      if (styleMode === 'wave') {
        // Dual counter-rotating continuous circular liquid waveform ribbons
        const outerPts: { x: number; y: number }[] = [];
        const innerPts: { x: number; y: number }[] = [];
        for (let i = 0; i < numBars; i++) {
          const angle = i * angleStep + rotationAngle;
          const waveSample = smoothedWave[Math.floor((i / numBars) * smoothedWave.length)] || 0;
          const freqSample = smoothedBars[i] || 0;
          const outerDisp =
            (freqSample * 0.72 + Math.abs(waveSample) * 0.45) * (minDimension * 0.16) +
            Math.sin(wavePhase * 1.8 + i * 0.35) * (minDimension * 0.015);
          const rOut = baseRadius + 10 + Math.max(4, outerDisp);
          outerPts.push({ x: Math.cos(angle) * rOut, y: Math.sin(angle) * rOut });

          const angleInner = i * angleStep - rotationAngle * 1.3;
          const innerDisp =
            (freqSample * 0.45 + Math.abs(waveSample) * 0.32) * (minDimension * 0.11) +
            Math.cos(wavePhase * 2.1 - i * 0.4) * (minDimension * 0.012);
          const rIn = baseRadius + 5 + Math.max(2, innerDisp);
          innerPts.push({ x: Math.cos(angleInner) * rIn, y: Math.sin(angleInner) * rIn });
        }

        drawClosedSmoothRing(outerPts);
        ctx.fillStyle = colors.ribbonFill;
        ctx.fill();
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 3.2;
        ctx.stroke();

        drawClosedSmoothRing(innerPts);
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 2.0;
        ctx.stroke();
      } else {
        // Organic circular wave halo behind the radial bars/spikes
        const haloPts: { x: number; y: number }[] = [];
        for (let i = 0; i < numBars; i++) {
          const angle = i * angleStep - rotationAngle * 0.65;
          const waveSample = smoothedWave[Math.floor((i / numBars) * smoothedWave.length)] || 0;
          const freqSample = smoothedBars[i] || 0;
          const rHalo =
            baseRadius +
            10 +
            freqSample * (minDimension * 0.11) +
            waveSample * (minDimension * 0.045);
          haloPts.push({ x: Math.cos(angle) * rHalo, y: Math.sin(angle) * rHalo });
        }
        drawClosedSmoothRing(haloPts);
        ctx.fillStyle = colors.ribbonFill;
        ctx.fill();
        ctx.strokeStyle = colors.ribbonAlt;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Radial spectrum bars or spikes
        for (let i = 0; i < numBars; i++) {
          const angle = i * angleStep + rotationAngle;
          const normalized = smoothedBars[i] || 0;
          const barHeight = Math.max(
            5,
            normalized * (minDimension * (styleMode === 'spikes' ? 0.21 : 0.175)) * (1 + smoothedBass * 0.45)
          );
          const x1 = Math.cos(angle) * (baseRadius + 6);
          const y1 = Math.sin(angle) * (baseRadius + 6);
          const x2 = Math.cos(angle) * (baseRadius + 6 + barHeight);
          const y2 = Math.sin(angle) * (baseRadius + 6 + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          if (styleMode === 'ring') {
            ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
            ctx.lineWidth = Math.max(2.4, ((Math.PI * 2 * baseRadius) / numBars) * 0.62);
            ctx.lineCap = 'round';
          } else {
            ctx.strokeStyle = i % 3 === 0 ? colors.accent : colors.primary;
            ctx.lineWidth = 1.9;
            ctx.lineCap = 'butt';
          }
          ctx.stroke();

          if (normalized > 0.36) {
            ctx.beginPath();
            ctx.arc(x2, y2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = isLightNow ? colors.primary : '#FFFFFF';
            ctx.fill();
          }
        }
      }

      ctx.restore();

      // 7. Center Disc & Spinning Cover Artwork with subtle bass breathing pulse
      const discRadius = baseRadius * (0.93 + smoothedBass * 0.065);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.clip();

      if (coverImageRef.current && coverImageRef.current.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle * 0.75);
        ctx.drawImage(
          coverImageRef.current,
          -discRadius,
          -discRadius,
          discRadius * 2,
          discRadius * 2
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#111827';
        ctx.fillRect(centerX - discRadius, centerY - discRadius, discRadius * 2, discRadius * 2);
      }

      // Vinyl groove rings overlay
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.2;
      for (let r = discRadius * 0.35; r < discRadius; r += 16) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Center Spindle Hole
      const spindleRadius = discRadius * 0.17;
      ctx.beginPath();
      ctx.arc(centerX, centerY, spindleRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#06080D';
      ctx.fill();
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, spindleRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore();

      // Outer glowing rim around disc
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius + 1, 0, Math.PI * 2);
      ctx.strokeStyle = colors.primary;
      ctx.globalAlpha = 0.45 + smoothedTreble * 0.45;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 8. Real-Time In-Canvas Live Lyrics / Transcript Overlay
      if (showLyricsOverlayRef.current) {
        const hudY = height - 74;
        const curLyric = activeLyricRef.current;
        const nxtLyric = nextLyricRef.current;
        ctx.save();
        ctx.textAlign = 'center';

        if (curLyric) {
          ctx.font = '600 20px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isLightNow ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)';
          ctx.fillText(curLyric.text, centerX + 1, hudY + 1);

          ctx.fillStyle = isLightNow ? '#047857' : colors.accent;
          ctx.fillText(curLyric.text, centerX, hudY);
        }

        if (nxtLyric) {
          ctx.font = '400 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = isLightNow ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.45)';
          ctx.fillText(nxtLyric.text, centerX, hudY + 26);
        }

        ctx.restore();
      }

      frameCount += 1;
      if (frameCount % 12 === 0) {
        canvas.dataset.orbwaveFrames = String(frameCount);
        canvas.dataset.orbwaveLevel = smoothedLevel.toFixed(3);
      }
    };

    const renderLoop = (ts: number) => {
      if (document.hidden) {
        animId = 0;
        return;
      }
      const livePlaying = isPlayingRef.current || sharedAudioEngine.getIsPlaying();
      const minIntervalMs = !livePlaying ? 50 : lowCpuModeRef.current ? 42 : 0;
      if (minIntervalMs === 0 || ts - lastFrameTs >= minIntervalMs) {
        lastFrameTs = ts;
        drawFrame(ts);
      }
      animId = requestAnimationFrame(renderLoop);
    };

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = lowCpuModeRef.current
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(rect.width * dpr);
      const targetH = Math.floor(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      drawFrame(performance.now());
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
      } else if (!animId) {
        lastFrameTs = 0;
        animId = requestAnimationFrame(renderLoop);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && containerRef.current
        ? new ResizeObserver(() => handleResize())
        : null;
    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    if (!document.hidden) {
      animId = requestAnimationFrame(renderLoop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver?.disconnect();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="orbwave-canvas-container"
      className="relative w-full h-full min-h-[260px] sm:min-h-[300px] xl:min-h-[400px] bg-[var(--bg-app)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] flex flex-col items-center justify-center select-none transition-colors"
    >
      {/* Visualizer Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="orbwave-canvas"
        className="absolute inset-0 w-full h-full block"
      />

      {/* Top HUD bar with metadata and controls */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex items-center justify-between gap-2 z-10 pointer-events-auto">
        <div className="bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 sm:px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] tracking-wide shrink-0">ORBWAVE STUDIO</span>
          <span className="text-xs text-[var(--text-dim)] hidden sm:inline">&middot;</span>
          <span className="text-xs text-[var(--text-secondary)] font-medium truncate max-w-[140px] sm:max-w-[200px]">{title}</span>
          <span className="text-xs text-[var(--text-dim)] hidden md:inline">&middot;</span>
          <span className="text-xs text-[var(--text-dim)] truncate max-w-[140px] hidden md:inline">{artist}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="orbwave-config-btn"
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-lg bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Configure Visualizer"
          >
            <Sliders size={16} />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Configuration Drawer */}
      {showConfig && (
        <div className="absolute top-16 right-4 z-20 bg-[var(--bg-surface)]/95 backdrop-blur-lg border border-[var(--border-medium)] p-4 rounded-xl shadow-2xl w-64 text-xs space-y-3">
          <div>
            <label className="text-[var(--text-secondary)] font-medium block mb-1.5">Color Palette</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['emerald', 'cyber', 'amber', 'ice'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPalette(p)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left capitalize font-medium transition-all cursor-pointer ${
                    selectedPalette === p
                      ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[var(--text-secondary)] font-medium block mb-1.5">Wave Style</label>
            <div className="grid grid-cols-3 gap-1">
              {(['ring', 'wave', 'spikes'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  data-testid={`orbwave-style-${style}`}
                  onClick={() => setBarStyle(style)}
                  className={`px-2 py-1 rounded-md border capitalize font-medium transition-all cursor-pointer ${
                    barStyle === style
                      ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-dim)]">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-[var(--accent-text)]" /> Live FFT 512 Wave
            </span>
            <span>{lowCpuMode ? '24 FPS Eco' : '60 FPS'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
