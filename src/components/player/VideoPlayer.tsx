import React, { useEffect, useRef, useState } from 'react';
import type { MusicVideoCandidate, Track } from '../../types';
import { Disc3, Film, Loader2, Maximize2, RefreshCw } from 'lucide-react';
import { applyCoverFallback } from '../../utils/coverFallback';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface VideoPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime?: number;
  hasLiveYouTubeStage?: boolean;
  isYtVisualReady?: boolean;
  ytStreamError?: string | null;
  isResolvingVideo?: boolean;
  videoCandidates?: MusicVideoCandidate[];
  activeVideoId?: string;
  onSelectVideoCandidate?: (videoId: string) => void;
  onRetryVideo?: () => void;
  onSwitchToAudioMode?: () => void;
  onRequestHostFullscreen?: () => void;
  lowCpuMode?: boolean;
  videoSlotRef?: React.RefObject<HTMLDivElement | null>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  track,
  isPlaying,
  currentTime = 0,
  hasLiveYouTubeStage = false,
  isYtVisualReady = true,
  ytStreamError = null,
  isResolvingVideo = false,
  videoCandidates = [],
  activeVideoId = '',
  onSelectVideoCandidate,
  onRetryVideo,
  onSwitchToAudioMode,
  onRequestHostFullscreen,
  lowCpuMode = false,
  videoSlotRef
}) => {
  const { t } = useAppPreferences();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentVideoKey = `${track.id}:${track.videoUrl || ''}`;
  const [errorVideoKey, setErrorVideoKey] = useState<string | null>(null);
  const videoError = errorVideoKey === currentVideoKey;

  const hasMp4Video = Boolean(track.videoUrl && track.videoUrl.trim().length > 0 && !videoError);
  const currentCandidate =
    videoCandidates.find((c) => c.videoId === activeVideoId) || videoCandidates[0];
  const currentIdx = videoCandidates.findIndex((c) => c.videoId === activeVideoId);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || hasLiveYouTubeStage || !hasMp4Video) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying, track.videoUrl, hasLiveYouTubeStage, hasMp4Video]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || hasLiveYouTubeStage || !hasMp4Video) return;
    if (typeof vid.duration === 'number' && Number.isFinite(vid.duration) && vid.duration > 0) {
      const target = currentTime % vid.duration;
      if (Math.abs(vid.currentTime - target) > 1.5) {
        vid.currentTime = target;
      }
    }
  }, [currentTime, hasLiveYouTubeStage, hasMp4Video]);

  const handleFullscreen = () => {
    if (hasLiveYouTubeStage && onRequestHostFullscreen) {
      onRequestHostFullscreen();
      return;
    }
    const target = containerRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      target.requestFullscreen?.().catch(() => {});
    }
  };

  const handleCycleCandidate = () => {
    if (videoCandidates.length <= 1 || !onSelectVideoCandidate) return;
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % videoCandidates.length : 0;
    onSelectVideoCandidate(videoCandidates[nextIdx].videoId);
  };

  return (
    <div
      ref={containerRef}
      data-testid="video-player-container"
      className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] flex flex-col justify-between group"
    >
      {/* Main 16:9 Video Viewport (YouTube IFrame Host overlays videoSlotRef when active) */}
      <div className="relative flex-1 min-h-[210px] w-full flex items-center justify-center overflow-hidden bg-black">
        {hasLiveYouTubeStage && videoSlotRef ? (
          <div className="relative w-full h-full min-h-[210px] bg-transparent">
            {/* Crisp cover-art poster shown transparently underneath until YT frame renders */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden ${
                !isYtVisualReady && ytStreamError ? 'z-20' : 'pointer-events-none'
              }`}
            >
              <img
                src={track.coverUrl}
                alt={track.title}
                onError={applyCoverFallback}
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-35"
              />
              <div className="absolute inset-0 bg-[#0a0d12]/90" />
              {!isYtVisualReady && ytStreamError ? (
                <div className="relative z-10 flex flex-col items-center gap-3 max-w-sm">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      onError={applyCoverFallback}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-medium text-white/85">{t.videoUnavailable}</p>
                  <div className="flex items-center justify-center gap-2">
                    {onRetryVideo && (
                      <button
                        type="button"
                        data-testid="video-retry-btn"
                        onClick={onRetryVideo}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold cursor-pointer transition-colors"
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    )}
                    {onSwitchToAudioMode && (
                      <button
                        type="button"
                        onClick={onSwitchToAudioMode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Disc3 size={12} />
                        <span>{t.audioMasterMode}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-white">
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                  <span>
                    {!isResolvingVideo && (activeVideoId || currentCandidate?.videoId)
                      ? track.genre === 'Podcast'
                        ? 'Buffering video podcast...'
                        : 'Buffering video stream...'
                      : t.findingMusicVideo}
                  </span>
                </div>
              )}
            </div>
            <div
              ref={videoSlotRef}
              data-testid="video-yt-slot"
              className="relative z-10 w-full h-full min-h-[210px] bg-transparent"
            />
          </div>
        ) : hasMp4Video && !lowCpuMode ? (
          <video
            ref={videoRef}
            src={track.videoUrl}
            poster={track.coverUrl}
            onError={() => setErrorVideoKey(currentVideoKey)}
            className="w-full h-full object-cover transition-opacity duration-500 opacity-100"
            loop
            muted
            playsInline
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
            <img
              src={track.coverUrl}
              alt={track.title}
              onError={applyCoverFallback}
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-35"
            />
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative z-10 flex flex-col items-center gap-3 max-w-sm">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  onError={applyCoverFallback}
                  className="w-full h-full object-cover"
                />
              </div>
              {isResolvingVideo ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-white">
                  <Loader2 size={14} className="animate-spin text-emerald-400" />
                  <span>{t.findingMusicVideo}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-white/80">{t.videoUnavailable}</p>
                  <div className="flex items-center justify-center gap-2">
                    {onRetryVideo && (
                      <button
                        type="button"
                        data-testid="video-retry-btn"
                        onClick={onRetryVideo}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:brightness-110 transition cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        <span>Retry</span>
                      </button>
                    )}
                    {onSwitchToAudioMode && (
                      <button
                        type="button"
                        data-testid="video-to-audio-btn"
                        onClick={onSwitchToAudioMode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-semibold hover:bg-white/25 transition cursor-pointer"
                      >
                        <Disc3 size={12} />
                        <span>{t.audioMasterMode}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slim Non-Overlapping Video Theater Bar */}
      <div
        data-testid="video-theater-controls"
        className="px-3.5 py-2 bg-[#0b0f14]/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-white shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              hasLiveYouTubeStage
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-white/10 text-white/75 border border-white/15'
            }`}
          >
            <Film size={11} />
            <span>{track.genre === 'Podcast' ? 'PODCAST VIDEO' : t.musicVideoBadge}</span>
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {currentCandidate?.title || `${track.artist} - ${track.title}`}
            </div>
            {currentCandidate?.author && (
              <div className="text-[10px] text-white/55 truncate">
                {currentCandidate.author}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {videoCandidates.length > 1 && onSelectVideoCandidate && (
            <button
              type="button"
              data-testid="video-switch-candidate-btn"
              onClick={handleCycleCandidate}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition cursor-pointer"
              title={t.switchVideoVersion}
            >
              <RefreshCw size={11} />
              <span>
                {t.switchVideoVersion}{' '}
                {currentIdx >= 0 ? `${currentIdx + 1}/${videoCandidates.length}` : ''}
              </span>
            </button>
          )}

          {onSwitchToAudioMode && track.audioUrl && (
            <button
              type="button"
              data-testid="video-to-audio-btn"
              onClick={onSwitchToAudioMode}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition cursor-pointer"
              title={t.audioMasterMode}
            >
              <Disc3 size={11} />
              <span className="hidden sm:inline">{t.audioMasterMode}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="video-fullscreen-btn"
            onClick={handleFullscreen}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
            aria-label="Fullscreen video"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
