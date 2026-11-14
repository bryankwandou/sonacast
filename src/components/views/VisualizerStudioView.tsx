import React, { useState, useEffect } from 'react';
import type { Track } from '../../types';
import { OrbwaveCanvas } from '../visualizer/OrbwaveCanvas';
import { sharedAudioEngine } from '../../services/audioEngine';
import { Sparkles } from 'lucide-react';

interface VisualizerStudioViewProps {
  currentTrack: Track;
  currentTime: number;
  onCustomAudioLoaded?: (title: string, artist: string, audioUrl: string) => void;
}

export const VisualizerStudioView: React.FC<VisualizerStudioViewProps> = ({
  currentTrack,
  currentTime
}) => {
  const [telemetry, setTelemetry] = useState({ bass: 0, mid: 0, treble: 0, level: 0 });
  const [palette, setPalette] = useState<'emerald' | 'cyber' | 'amber' | 'ice'>('emerald');

  useEffect(() => {
    let animId: number;
    const update = () => {
      const spec = sharedAudioEngine.getSpectrum();
      setTelemetry({
        bass: spec.bass,
        mid: spec.mid,
        treble: spec.treble,
        level: spec.level
      });
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div
        className="p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-2">
            <Sparkles size={13} />
            <span>ORBWAVE SPECTRUM ENGINE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">Visualizer Studio</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            Real-time FFT audio analysis, log-spaced frequency rings, and live synchronized lyrics overlay.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['emerald', 'cyber', 'amber', 'ice'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPalette(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                palette === p
                  ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Full Visualizer Canvas */}
      <div className="w-full h-[380px] sm:h-[500px]">
        <OrbwaveCanvas
          coverUrl={currentTrack.coverUrl}
          title={currentTrack.title}
          artist={currentTrack.artist}
          lyrics={currentTrack.lyrics}
          currentTime={currentTime}
          palette={palette}
        />
      </div>

      {/* Telemetry Meters & DSP Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-dim)] font-mono block">Sub-Bass (30 - 250 Hz)</span>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">{(telemetry.bass * 100).toFixed(1)}%</div>
          <div className="w-full bg-[var(--bg-elevated)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-75"
              style={{ width: `${Math.min(100, telemetry.bass * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-dim)] font-mono block">Midrange (250 - 2 kHz)</span>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">{(telemetry.mid * 100).toFixed(1)}%</div>
          <div className="w-full bg-[var(--bg-elevated)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-cyan-500 h-full transition-all duration-75"
              style={{ width: `${Math.min(100, telemetry.mid * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-dim)] font-mono block">High Treble (2 - 16 kHz)</span>
          <div className="text-lg font-bold text-[var(--text-primary)] mt-1">{(telemetry.treble * 100).toFixed(1)}%</div>
          <div className="w-full bg-[var(--bg-elevated)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-violet-500 h-full transition-all duration-75"
              style={{ width: `${Math.min(100, telemetry.treble * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-dim)] font-mono block">RMS Energy Level</span>
          <div className="text-lg font-bold text-[var(--accent-text)] mt-1">{(telemetry.level * 100).toFixed(1)}%</div>
          <div className="w-full bg-[var(--bg-elevated)] h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-75"
              style={{ width: `${Math.min(100, telemetry.level * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
