import React, { useRef, useEffect, useState } from 'react';
import { Video, Maximize2, Minimize2, Radio } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl?: string;
  coverUrl: string;
  title: string;
  artist: string;
  isPlaying: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  coverUrl,
  title,
  artist,
  isPlaying
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        // Autoplay policy fallback: muted video loop
        video.muted = true;
        video.play().catch(() => {});
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl]);

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
      className="relative w-full h-full min-h-[460px] bg-black rounded-2xl overflow-hidden border border-[#1E2433] flex items-center justify-center select-none group"
    >
      {videoUrl && !videoError ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={coverUrl}
          loop
          playsInline
          muted
          onError={() => setVideoError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        // Ambient fallback visual video loop
        <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#080B12] via-[#121826] to-[#0A0E17]">
          <img
            src={coverUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
          />
          <div className="relative z-10 text-center p-6 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 max-w-sm">
            <Video size={40} className="mx-auto text-emerald-400 mb-3 animate-pulse" />
            <h3 className="text-white font-bold text-lg">{title}</h3>
            <p className="text-gray-400 text-xs mt-1">Live Ambient Visual Stream Active</p>
          </div>
        </div>
      )}

      {/* Top Overlay Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 opacity-90 transition-opacity">
        <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-white font-semibold tracking-wider">LIVE STREAM 1080P</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-300 truncate max-w-[200px]">{title}</span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Bottom Bar Info */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 rounded-xl">
        <div>
          <h4 className="text-white font-bold text-base truncate">{title}</h4>
          <p className="text-gray-300 text-xs">{artist}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
          <Radio size={12} />
          <span>Synced with Master Audio</span>
        </div>
      </div>
    </div>
  );
};

