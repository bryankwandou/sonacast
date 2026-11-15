import React from 'react';

interface PlayingBarsProps {
  isPlaying: boolean;
  lowCpuMode?: boolean;
  className?: string;
}

export const PlayingBars: React.FC<PlayingBarsProps> = ({
  isPlaying,
  lowCpuMode = false,
  className = ''
}) => {
  const animate = isPlaying && !lowCpuMode;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-[2px] h-3.5 w-3.5 shrink-0 ${className}`}
    >
      <span
        className={`w-[2.5px] rounded-full bg-current ${animate ? 'sonacast-eq-bar h-full' : isPlaying ? 'h-[55%]' : 'h-[35%] opacity-50'}`}
        style={animate ? { animationDelay: '0ms' } : undefined}
      />
      <span
        className={`w-[2.5px] rounded-full bg-current ${animate ? 'sonacast-eq-bar h-full' : isPlaying ? 'h-[95%]' : 'h-[65%] opacity-50'}`}
        style={animate ? { animationDelay: '220ms' } : undefined}
      />
      <span
        className={`w-[2.5px] rounded-full bg-current ${animate ? 'sonacast-eq-bar h-full' : isPlaying ? 'h-[70%]' : 'h-[45%] opacity-50'}`}
        style={animate ? { animationDelay: '110ms' } : undefined}
      />
    </span>
  );
};
