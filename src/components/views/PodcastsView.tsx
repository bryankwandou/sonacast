import React from 'react';
import type { PodcastEpisode } from '../../types';
import { Mic2, Play, Clock } from 'lucide-react';

interface PodcastsViewProps {
  podcasts: PodcastEpisode[];
  onSelectPodcast: (episode: PodcastEpisode) => void;
  activeEpisodeId?: string;
}

export const PodcastsView: React.FC<PodcastsViewProps> = ({
  podcasts,
  onSelectPodcast,
  activeEpisodeId
}) => {
  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0E1320] to-[#0A0D15] border border-[#1E2638] flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-2">
            <Mic2 size={13} />
            <span>TALK & LIVE VIDEO DISCUSSIONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Curated Podcasts</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-lg">
            High-bandwidth conversations with synchronized line-by-line live transcripts and Solana creator tipping.
          </p>
        </div>
      </div>

      {/* Episode List */}
      <div className="space-y-4">
        {podcasts.map((ep) => {
          const isActive = ep.id === activeEpisodeId;
          return (
            <div
              key={ep.id}
              onClick={() => onSelectPodcast(ep)}
              className={`p-5 rounded-2xl bg-[#0D111A] border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:border-[#2C3850] ${
                isActive ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10' : 'border-[#1B2232]'
              }`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={ep.coverUrl}
                  alt={ep.title}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 border border-[#1E2638]"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                      EPISODE #{ep.episodeNumber}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{ep.podcastName}</span>
                  </div>
                  <h3 className="text-base font-bold text-white hover:text-emerald-300 transition-colors">
                    {ep.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-2xl">{ep.description}</p>
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1 font-mono">
                    <Clock size={12} className="text-emerald-400" />
                    <span>{Math.floor(ep.duration / 60)} minutes · Host: {ep.host}</span>
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <button className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20">
                  <Play size={13} fill="currentColor" />
                  <span>Play Episode</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
