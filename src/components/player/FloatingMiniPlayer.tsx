import React, { useEffect, useRef, useState } from 'react';
import type { Track } from '../../types';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Maximize2,
  Pause,
  PictureInPicture2,
  Play,
  SkipForward,
  X,
  Zap
} from 'lucide-react';
import { applyCoverFallback, buildCoverFallbackDataUri } from '../../utils/coverFallback';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface FloatingMiniPlayerProps {
  track: Track;
  isPlaying: boolean;
  lowCpuMode: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onRestoreStage: () => void;
  onCloseFloating: () => void;
  onOpenDesktopPip: () => void;
}

export interface DesktopPipController {
  isOpen: () => boolean;
  update: (payload: {
    track: Track;
    isPlaying: boolean;
    activeLyricText: string;
    lowCpuMode: boolean;
  }) => void;
  close: () => void;
}

export const openDesktopPipWindow = async (callbacks: {
  track: Track;
  isPlaying: boolean;
  activeLyricText: string;
  lowCpuMode: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClosed?: () => void;
}): Promise<DesktopPipController | null> => {
  const docPip = (window as unknown as {
    documentPictureInPicture?: {
      requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
    };
  }).documentPictureInPicture;

  if (docPip?.requestWindow) {
    const pipWin = await docPip.requestWindow({ width: 356, height: 158 });
    const doc = pipWin.document;
    doc.title = `${callbacks.track.title} - Sonacast`;

    const style = doc.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
      body { background: #090d16; color: #f8fafc; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; height: 100vh; overflow: hidden; user-select: none; }
      .row { display: flex; align-items: center; gap: 10px; }
      .cover { width: 46px; height: 46px; border-radius: 10px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.12); }
      .meta { min-width: 0; flex: 1; }
      .title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .artist { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
      .lyric { font-size: 11px; color: #34d399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 8px 0; min-height: 15px; }
      .controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .btns { display: flex; align-items: center; gap: 6px; }
      button { background: #1e293b; color: #f8fafc; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; height: 30px; min-width: 30px; padding: 0 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
      button.primary { background: #10b981; color: #042f2e; border-color: #10b981; }
      .badge { font-size: 10px; color: #94a3b8; font-family: monospace; }
    `;
    doc.head.appendChild(style);

    const root = doc.createElement('div');
    root.innerHTML = `
      <div class="row">
        <img id="sc-cover" class="cover" alt="" />
        <div class="meta">
          <div id="sc-title" class="title"></div>
          <div id="sc-artist" class="artist"></div>
        </div>
      </div>
      <div id="sc-lyric" class="lyric"></div>
      <div class="controls">
        <div class="btns">
          <button id="sc-prev" type="button">Prev</button>
          <button id="sc-play" type="button" class="primary">Play</button>
          <button id="sc-next" type="button">Next</button>
        </div>
        <span id="sc-mode" class="badge"></span>
      </div>
    `;
    doc.body.appendChild(root);

    const coverEl = doc.getElementById('sc-cover') as HTMLImageElement;
    const titleEl = doc.getElementById('sc-title') as HTMLElement;
    const artistEl = doc.getElementById('sc-artist') as HTMLElement;
    const lyricEl = doc.getElementById('sc-lyric') as HTMLElement;
    const playEl = doc.getElementById('sc-play') as HTMLButtonElement;
    const modeEl = doc.getElementById('sc-mode') as HTMLElement;

    doc.getElementById('sc-prev')?.addEventListener('click', () => callbacks.onPrev());
    playEl.addEventListener('click', () => callbacks.onTogglePlay());
    doc.getElementById('sc-next')?.addEventListener('click', () => callbacks.onNext());

    const syncUi = (payload: {
      track: Track;
      isPlaying: boolean;
      activeLyricText: string;
      lowCpuMode: boolean;
    }) => {
      if (pipWin.closed) return;
      doc.title = `${payload.track.title} - Sonacast`;
      coverEl.src =
        payload.track.coverUrl ||
        buildCoverFallbackDataUri(payload.track.title, payload.track.artist);
      titleEl.textContent = payload.track.title;
      artistEl.textContent = payload.track.artist;
      lyricEl.textContent = payload.activeLyricText || '24/7 Background Stream';
      playEl.textContent = payload.isPlaying ? 'Pause' : 'Play';
      modeEl.textContent = payload.lowCpuMode ? 'ECO 24/7' : 'LIVE';
    };

    syncUi({
      track: callbacks.track,
      isPlaying: callbacks.isPlaying,
      activeLyricText: callbacks.activeLyricText,
      lowCpuMode: callbacks.lowCpuMode
    });

    pipWin.addEventListener('pagehide', () => {
      callbacks.onClosed?.();
    });

    return {
      isOpen: () => !pipWin.closed,
      update: syncUi,
      close: () => {
        if (!pipWin.closed) pipWin.close();
      }
    };
  }

  // Fallback for browsers with Video PiP but without Document PiP
  if ('pictureInPictureEnabled' in document && document.pictureInPictureEnabled) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    document.body.appendChild(video);

    const drawCanvas = (payload: {
      track: Track;
      isPlaying: boolean;
      activeLyricText: string;
      lowCpuMode: boolean;
    }) => {
      if (!ctx) return;
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, canvas.width, 6);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(payload.track.title.slice(0, 34), 24, 72);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(payload.track.artist.slice(0, 38), 24, 106);
      ctx.fillStyle = '#34d399';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText((payload.activeLyricText || '24/7 Audio Stream').slice(0, 44), 24, 162);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText(
        `${payload.isPlaying ? 'PLAYING' : 'PAUSED'} | ${payload.lowCpuMode ? 'LOW CPU ECO' : 'SONACAST'}`,
        24,
        210
      );
    };

    drawCanvas({
      track: callbacks.track,
      isPlaying: callbacks.isPlaying,
      activeLyricText: callbacks.activeLyricText,
      lowCpuMode: callbacks.lowCpuMode
    });

    const stream = canvas.captureStream(1);
    video.srcObject = stream;
    await video.play().catch(() => {});
    await video.requestPictureInPicture();

    const cleanup = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      video.remove();
      callbacks.onClosed?.();
    };
    video.addEventListener('leavepictureinpicture', cleanup, { once: true });

    return {
      isOpen: () => document.pictureInPictureElement === video,
      update: drawCanvas,
      close: () => {
        if (document.pictureInPictureElement === video) {
          document.exitPictureInPicture().catch(() => {});
        }
        cleanup();
      }
    };
  }

  return null;
};

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({
  track,
  isPlaying,
  lowCpuMode,
  onTogglePlay,
  onNext,
  onRestoreStage,
  onCloseFloating,
  onOpenDesktopPip
}) => {
  const { t } = useAppPreferences();
  const [isCompactIcon, setIsCompactIcon] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 24, y: 120 };
    return {
      x: Math.max(12, window.innerWidth - 318),
      y: Math.max(16, window.innerHeight - 178)
    };
  });

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const maxX = Math.max(12, window.innerWidth - (isCompactIcon ? 76 : 312));
      const maxY = Math.max(12, window.innerHeight - 110);
      setPos({
        x: Math.min(maxX, Math.max(8, dragRef.current.originX + dx)),
        y: Math.min(maxY, Math.max(8, dragRef.current.originY + dy))
      });
    };
    const handleUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isCompactIcon]);

  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y
    };
  };

  if (isCompactIcon) {
    return (
      <div
        data-testid="floating-mini-bubble"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        className="fixed z-50 flex items-center gap-1 p-1.5 rounded-full bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--accent-border)] shadow-2xl select-none"
      >
        <div
          onPointerDown={startDrag}
          title={track.title}
          className="relative w-11 h-11 rounded-full overflow-hidden cursor-grab active:cursor-grabbing shrink-0"
        >
          <img
            src={track.coverUrl || buildCoverFallbackDataUri(track.title, track.artist)}
            alt={track.title}
            onError={(e) => applyCoverFallback(e, track.title, track.artist)}
            className={`w-full h-full object-cover ${
              isPlaying && !lowCpuMode ? 'animate-[spin_10s_linear_infinite]' : ''
            }`}
          />
          {lowCpuMode && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center">
              <Zap size={8} />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-8 h-8 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] flex items-center justify-center cursor-pointer"
        >
          {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>

        <button
          type="button"
          onClick={() => setIsCompactIcon(false)}
          aria-label="Expand mini bar"
          className="p-1.5 rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="floating-mini-bubble"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 w-[300px] max-w-[calc(100vw-16px)] rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-lg border border-[var(--border-medium)] shadow-2xl p-2.5 select-none"
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onPointerDown={startDrag}
          aria-label="Drag floating player"
          className="p-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical size={14} />
        </button>

        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[var(--border-subtle)] shrink-0">
          <img
            src={track.coverUrl || buildCoverFallbackDataUri(track.title, track.artist)}
            alt={track.title}
            onError={(e) => applyCoverFallback(e, track.title, track.artist)}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[var(--text-primary)] truncate">{track.title}</div>
          <div className="text-[10px] text-[var(--text-dim)] truncate flex items-center gap-1">
            <span className="truncate">{track.artist}</span>
            {lowCpuMode && (
              <span className="px-1 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] font-mono shrink-0">
                ECO
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-8 h-8 rounded-full bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] flex items-center justify-center shrink-0 cursor-pointer"
        >
          {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] cursor-pointer shrink-0"
        >
          <SkipForward size={14} />
        </button>
      </div>

      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-1 text-[10px]">
        <button
          type="button"
          onClick={() => setIsCompactIcon(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] cursor-pointer"
        >
          <ChevronDown size={11} />
          <span>Icon</span>
        </button>

        <button
          type="button"
          onClick={onOpenDesktopPip}
          title={t.desktopPip}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] cursor-pointer"
        >
          <PictureInPicture2 size={11} />
          <span>{t.desktopPip}</span>
        </button>

        <button
          type="button"
          onClick={onRestoreStage}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[var(--accent-text)] hover:bg-[var(--accent-soft)] font-semibold cursor-pointer"
        >
          <Maximize2 size={11} />
          <span>Stage</span>
        </button>

        <button
          type="button"
          onClick={onCloseFloating}
          aria-label="Close floating player"
          className="p-1 rounded-md text-[var(--text-dim)] hover:text-rose-400 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

