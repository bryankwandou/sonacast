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
}

const PALETTES = {
  emerald: {
    primary: '#10B981',
    secondary: '#06B6D4',
    glow: 'rgba(16, 185, 129, 0.45)',
    accent: '#34D399'
  },
  cyber: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    glow: 'rgba(139, 92, 246, 0.45)',
    accent: '#F472B6'
  },
  amber: {
    primary: '#F59E0B',
    secondary: '#EF4444',
    glow: 'rgba(245, 158, 11, 0.45)',
    accent: '#FBBF24'
  },
  ice: {
    primary: '#38BDF8',
    secondary: '#818CF8',
    glow: 'rgba(56, 189, 248, 0.45)',
    accent: '#60A5FA'
  }
};

export const OrbwaveCanvas: React.FC<OrbwaveCanvasProps> = ({
  coverUrl,
  title,
  artist,
  lyrics,
  currentTime,
  palette = 'emerald'
}) => {
  const { theme } = useAppPreferences();
  const isLight = theme === 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<'emerald' | 'cyber' | 'amber' | 'ice'>(palette);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [barStyle, setBarStyle] = useState<'ring' | 'spikes' | 'wave'>('ring');

  const coverImageRef = useRef<HTMLImageElement | null>(null);

  // Preload cover image without CORS cache lock-in and reset cleanly on track change
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

  // Find currently active lyric line
  const activeLyric = lyrics.slice().reverse().find((l) => currentTime >= l.time) || lyrics[0];
  const nextLyric = lyrics.find((l) => l.time > currentTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let rotationAngle = 0;

    // Deterministic particle set
    const particles = Array.from({ length: 48 }, (_, i) => ({
      x: (Math.sin(i * 99) * 0.5 + 0.5),
      y: (Math.cos(i * 33) * 0.5 + 0.5),
      size: (i % 3) + 1.2,
      speed: (i % 5) * 0.0003 + 0.0002,
      opacity: (i % 7) * 0.1 + 0.3
    }));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const minDimension = Math.min(width, height);
      const baseRadius = minDimension * 0.22;

      const spectrum = sharedAudioEngine.getSpectrum();
      const bassEnergy = spectrum.bass;
      const levelEnergy = spectrum.level;
      const colors = PALETTES[selectedPalette];

      // 1. Clear with theme-aware gradient background
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        minDimension * 0.75
      );
      if (isLight) {
        bgGrad.addColorStop(0, '#FFFFFF');
        bgGrad.addColorStop(0.6, '#ECF5F1');
        bgGrad.addColorStop(1, '#E2E8F0');
      } else {
        bgGrad.addColorStop(0, '#0E131F');
        bgGrad.addColorStop(0.6, '#080A10');
        bgGrad.addColorStop(1, '#040507');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Particle Field drifting with audio level
      particles.forEach((p) => {
        p.y -= p.speed * (1 + levelEnergy * 2);
        if (p.y < 0) p.y = 1;

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size * (1 + bassEnergy * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(5, 150, 105, ${p.opacity * (0.28 + levelEnergy * 0.45)})`
          : `rgba(255, 255, 255, ${p.opacity * (0.4 + levelEnergy * 0.6)})`;
        ctx.fill();
      });

      // 3. Ambient Glow behind the disc reacting to bass
      const glowRadius = (baseRadius + 40) * (1 + bassEnergy * 0.28);
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.8,
        centerX,
        centerY,
        glowRadius
      );
      ambientGlow.addColorStop(0, colors.glow);
      ambientGlow.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Circular Frequency Spectrum Bars
      const numBars = 72;
      const angleStep = (Math.PI * 2) / numBars;
      rotationAngle += 0.003 + bassEnergy * 0.004;

      ctx.save();
      ctx.translate(centerX, centerY);

      for (let i = 0; i < numBars; i++) {
        const angle = i * angleStep + rotationAngle;
        // Log-spaced index into spectrum frequency array
        const logIndex = Math.floor(Math.pow(i / numBars, 1.4) * (spectrum.frequencies.length * 0.7));
        const rawVal = spectrum.frequencies[logIndex] || 0;
        const normalized = rawVal / 255;
        const barHeight = Math.max(4, normalized * (minDimension * 0.16) * (1 + bassEnergy * 0.4));

        const x1 = Math.cos(angle) * (baseRadius + 6);
        const y1 = Math.sin(angle) * (baseRadius + 6);
        const x2 = Math.cos(angle) * (baseRadius + 6 + barHeight);
        const y2 = Math.sin(angle) * (baseRadius + 6 + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (barStyle === 'ring') {
          ctx.strokeStyle = i % 2 === 0 ? colors.primary : colors.secondary;
          ctx.lineWidth = Math.max(2.2, (Math.PI * 2 * baseRadius) / numBars * 0.65);
          ctx.lineCap = 'round';
        } else if (barStyle === 'spikes') {
          ctx.strokeStyle = colors.accent;
          ctx.lineWidth = 1.6;
          ctx.lineCap = 'butt';
        } else {
          // Waveform line
          ctx.strokeStyle = colors.primary;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
        }
        ctx.stroke();

        // Optional glowing tip bead
        if (normalized > 0.45) {
          ctx.beginPath();
          ctx.arc(x2, y2, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = isLight ? colors.primary : '#FFFFFF';
          ctx.fill();
        }
      }
      ctx.restore();

      // 5. Center Disc & Spinning Cover Artwork
      const discRadius = baseRadius * 0.94;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.clip();

      if (coverImageRef.current && coverImageRef.current.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle * 0.5);
        ctx.drawImage(
          coverImageRef.current,
          -discRadius,
          -discRadius,
          discRadius * 2,
          discRadius * 2
        );
        ctx.restore();
      } else {
        // Fallback procedural vinyl disc
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
      const spindleRadius = discRadius * 0.18;
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

      // 6. Real-Time In-Canvas Live Lyrics / Transcript Overlay
      // Renders directly over visualizer without needing pre-rendered video!
      const hudY = height - 74;
      ctx.save();
      ctx.textAlign = 'center';

      // Current active lyric line
      if (activeLyric) {
        ctx.font = '600 20px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)';
        ctx.fillText(activeLyric.text, centerX + 1, hudY + 1);

        ctx.fillStyle = isLight ? '#047857' : colors.accent;
        ctx.fillText(activeLyric.text, centerX, hudY);
      }

      // Next lyric line preview
      if (nextLyric) {
        ctx.font = '400 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(nextLyric.text, centerX, hudY + 26);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [coverUrl, selectedPalette, barStyle, activeLyric, nextLyric, isLight]);

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
      className="relative w-full h-full min-h-[260px] sm:min-h-[300px] xl:min-h-[400px] bg-[var(--bg-app)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] flex flex-col items-center justify-center select-none transition-colors"
    >
      {/* Visualizer Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Top HUD bar with metadata and controls */}
      <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 flex items-center justify-between gap-2 z-10 pointer-events-auto">
        <div className="bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 sm:px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse shrink-0" />
          <span className="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] tracking-wide shrink-0">ORBWAVE LIVE</span>
          <span className="text-xs text-[var(--text-dim)] hidden sm:inline">&middot;</span>
          <span className="text-xs text-[var(--text-secondary)] font-medium truncate max-w-[140px] sm:max-w-[200px]">{title}</span>
          <span className="text-xs text-[var(--text-dim)] hidden md:inline">&middot;</span>
          <span className="text-xs text-[var(--text-dim)] truncate max-w-[140px] hidden md:inline">{artist}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
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
            <label className="text-[var(--text-secondary)] font-medium block mb-1.5">Ring Style</label>
            <div className="grid grid-cols-3 gap-1">
              {(['ring', 'spikes', 'wave'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
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
              <Sparkles size={12} className="text-[var(--accent-text)]" /> Web Audio FFT 512
            </span>
            <span>60 FPS</span>
          </div>
        </div>
      )}
    </div>
  );
};

