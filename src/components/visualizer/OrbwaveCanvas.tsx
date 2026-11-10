import React, { useEffect, useRef, useState } from 'react';
import { sharedAudioEngine } from '../../services/audioEngine';
import type { LyricLine } from '../../types';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<'emerald' | 'cyber' | 'amber' | 'ice'>(palette);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [barStyle, setBarStyle] = useState<'ring' | 'spikes' | 'wave'>('ring');

  const coverImageRef = useRef<HTMLImageElement | null>(null);

  // Preload cover image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = coverUrl;
    img.onload = () => {
      coverImageRef.current = img;
    };
  }, [coverUrl]);

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

      // 1. Clear with deep gradient background
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        minDimension * 0.75
      );
      bgGrad.addColorStop(0, '#0E131F');
      bgGrad.addColorStop(0.6, '#080A10');
      bgGrad.addColorStop(1, '#040507');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Particle Field drifting with audio level
      particles.forEach((p) => {
        p.y -= p.speed * (1 + levelEnergy * 2);
        if (p.y < 0) p.y = 1;

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size * (1 + bassEnergy * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * (0.4 + levelEnergy * 0.6)})`;
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
          ctx.fillStyle = '#FFFFFF';
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
        // Subtle drop shadow for optimal contrast against high-energy visualizer
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillText(activeLyric.text, centerX + 1, hudY + 1);

        // Active highlighted text with gradient glow
        ctx.fillStyle = colors.accent;
        ctx.fillText(activeLyric.text, centerX, hudY);
      }

      // Next lyric line preview
      if (nextLyric) {
        ctx.font = '400 13px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
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
  }, [coverUrl, selectedPalette, barStyle, activeLyric, nextLyric]);

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
      className="relative w-full h-full min-h-[460px] bg-[#07090E] rounded-2xl overflow-hidden border border-[#1E2433] flex flex-col items-center justify-center select-none"
    >
      {/* Visualizer Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Top HUD bar with metadata and controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">
        <div className="bg-[#0D111A]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#242C3D] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">ORBWAVE LIVE ENGINE</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-300 font-medium truncate max-w-[200px]">{title}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400 truncate max-w-[140px]">{artist}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-lg bg-[#0D111A]/80 backdrop-blur-md border border-[#242C3D] text-gray-300 hover:text-white hover:bg-[#161D2B] transition-colors"
            title="Configure Visualizer"
          >
            <Sliders size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-[#0D111A]/80 backdrop-blur-md border border-[#242C3D] text-gray-300 hover:text-white hover:bg-[#161D2B] transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Configuration Drawer */}
      {showConfig && (
        <div className="absolute top-16 right-4 z-20 bg-[#0F1420]/95 backdrop-blur-lg border border-[#242C3D] p-4 rounded-xl shadow-2xl w-64 text-xs space-y-3">
          <div>
            <label className="text-gray-400 font-medium block mb-1.5">Color Palette</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['emerald', 'cyber', 'amber', 'ice'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPalette(p)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left capitalize font-medium transition-all ${
                    selectedPalette === p
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-[#242C3D] bg-[#141A26] text-gray-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-400 font-medium block mb-1.5">Ring Style</label>
            <div className="grid grid-cols-3 gap-1">
              {(['ring', 'spikes', 'wave'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setBarStyle(style)}
                  className={`px-2 py-1 rounded-md border capitalize font-medium transition-all ${
                    barStyle === style
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-[#242C3D] bg-[#141A26] text-gray-400 hover:text-white'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1 border-t border-[#242C3D]/60 flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-400" /> Web Audio FFT 512
            </span>
            <span>60 FPS</span>
          </div>
        </div>
      )}
    </div>
  );
};
