import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Share2, Sparkles, X } from 'lucide-react';
import type { LyricLine, Track } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import {
  exportLyricQuotePng,
  renderLyricCardCanvas,
  type LyricCardTheme
} from '../../services/recommendationEngine';
import { buildTrackShareUrl, copyTextToClipboard } from '../../utils/shareTrack';

interface LyricCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  initialLineIndex?: number | null;
  currentTime: number;
}

const THEME_OPTIONS: { id: LyricCardTheme; label: string; swatchClass: string }[] = [
  { id: 'nocturne', label: 'Nocturne', swatchClass: 'bg-[#0C1412] border-emerald-500/60' },
  { id: 'emerald', label: 'Emerald', swatchClass: 'bg-[#064E3B] border-emerald-300/70' },
  { id: 'daylight', label: 'Daylight', swatchClass: 'bg-[#FAF7F2] border-slate-400' }
];

function computeInitialLineIndices(
  lyrics: LyricLine[],
  initialLineIndex: number | null,
  currentTime: number
): number[] {
  if (lyrics.length === 0) return [];
  let seedIdx = 0;
  if (
    typeof initialLineIndex === 'number' &&
    initialLineIndex >= 0 &&
    initialLineIndex < lyrics.length
  ) {
    seedIdx = initialLineIndex;
  } else {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        seedIdx = i;
        break;
      }
    }
  }
  return seedIdx + 1 < lyrics.length ? [seedIdx, seedIdx + 1] : [seedIdx];
}

const LyricCardStudioContent: React.FC<Omit<LyricCardModalProps, 'isOpen'>> = ({
  onClose,
  track,
  initialLineIndex = null,
  currentTime
}) => {
  const { t } = useAppPreferences();
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lyrics = useMemo(
    () => (track.lyrics || []).filter((line) => Boolean(line?.text?.trim())),
    [track.lyrics]
  );

  const [theme, setTheme] = useState<LyricCardTheme>('nocturne');
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() =>
    computeInitialLineIndices(lyrics, initialLineIndex, currentTime)
  );
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedLines: LyricLine[] = useMemo(() => {
    if (lyrics.length === 0) return [];
    const ordered = [...selectedIndices].sort((a, b) => a - b);
    const chosen = ordered.map((idx) => lyrics[idx]).filter(Boolean);
    return chosen.length > 0 ? chosen : [lyrics[0]];
  }, [lyrics, selectedIndices]);

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    let active = true;
    void renderLyricCardCanvas(track, selectedLines, theme, previewCanvasRef.current).then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [track, selectedLines, theme]);

  const toggleLine = (idx: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== idx);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), idx];
      }
      return [...prev, idx].sort((a, b) => a - b);
    });
  };

  const buildSharePayload = () => {
    const excerpt =
      selectedLines.length > 0
        ? selectedLines.map((l) => `"${l.text.trim()}"`).join('\n')
        : `"${track.title}"`;
    const shareUrl = buildTrackShareUrl(track);
    return `${excerpt}\n— ${track.title}, ${track.artist}\n${shareUrl}`;
  };

  const handleCopyQuote = async () => {
    const ok = await copyTextToClipboard(buildSharePayload());
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleShareNative = async () => {
    const text = buildSharePayload();
    const url = buildTrackShareUrl(track);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${track.title} — ${track.artist}`,
          text,
          url
        });
        return;
      } catch {
        // User canceled native share or unsupported; fall back to copy
      }
    }
    await handleCopyQuote();
  };

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      const ok = await exportLyricQuotePng(
        track,
        selectedLines[0] || null,
        selectedLines[1] || null,
        theme,
        selectedLines
      );
      if (ok) {
        setDownloaded(true);
        window.setTimeout(() => setDownloaded(false), 2400);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={t.lyricCardStudio}
      data-testid="lyric-card-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                {t.lyricCardStudio}
              </h2>
              <p className="text-[11px] text-[var(--text-dim)] truncate">
                {track.title} &middot; {track.artist}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="lyric-card-close"
            aria-label={t.closeLabel}
            className="w-8 h-8 rounded-lg bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left: High-res Canvas Card Preview */}
          <div className="md:col-span-5 flex flex-col items-center gap-3.5">
            <div className="w-full max-w-[290px] aspect-[4/5] rounded-2xl overflow-hidden border border-[var(--border-medium)] shadow-xl bg-[#07090F]">
              <canvas
                ref={previewCanvasRef}
                data-testid="lyric-card-preview-canvas"
                className="w-full h-full object-contain block"
              />
            </div>

            {/* Theme Switcher */}
            <div className="flex items-center gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`lyric-theme-${opt.id}`}
                  onClick={() => setTheme(opt.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                    theme === opt.id
                      ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-tint)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border ${opt.swatchClass}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Select Lines & Actions */}
          <div className="md:col-span-7 flex flex-col gap-4 h-full min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                {t.selectLyricLinesHint}
              </p>
              <span className="text-[11px] font-mono font-bold text-[var(--accent-text)] shrink-0">
                {selectedIndices.length}/4
              </span>
            </div>

            <div className="max-h-[290px] overflow-y-auto space-y-1.5 pr-1 border border-[var(--border-subtle)] rounded-xl p-2 bg-[var(--bg-app)]">
              {lyrics.length === 0 ? (
                <div className="p-4 text-xs text-[var(--text-dim)] text-center">
                  {t.lyricsUnavailable} Track title &amp; artist card is ready to export.
                </div>
              ) : (
                lyrics.map((line, idx) => {
                  const isPicked = selectedIndices.includes(idx);
                  return (
                    <button
                      key={`${idx}-${line.time}`}
                      type="button"
                      onClick={() => toggleLine(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isPicked
                          ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--accent-border)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tint)] border border-transparent'
                      }`}
                    >
                      <span className="line-clamp-2">{line.text}</span>
                      {isPicked && <Check size={14} className="text-[var(--accent-text)] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isExporting}
                data-testid="lyric-card-download"
                className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 transition-colors"
              >
                {downloaded ? <Check size={15} /> : <Download size={15} />}
                <span>{downloaded ? 'Saved PNG' : t.downloadPng}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyQuote}
                data-testid="lyric-card-copy"
                className="py-2.5 px-4 rounded-xl bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copied ? <Check size={14} className="text-[var(--accent-text)]" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : t.copyQuote}</span>
              </button>

              <button
                type="button"
                onClick={handleShareNative}
                className="py-2.5 px-3.5 rounded-xl bg-[var(--bg-tint)] hover:bg-[var(--bg-tint-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Share"
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LyricCardModal: React.FC<LyricCardModalProps> = ({
  isOpen,
  onClose,
  track,
  initialLineIndex = null,
  currentTime
}) => {
  if (!isOpen) return null;
  return (
    <LyricCardStudioContent
      key={`${track.id}-${initialLineIndex ?? 'auto'}`}
      onClose={onClose}
      track={track}
      initialLineIndex={initialLineIndex}
      currentTime={currentTime}
    />
  );
};
