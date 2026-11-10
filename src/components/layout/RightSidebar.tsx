import React from 'react';
import type { Track, RadioStation } from '../../types';
import { Play, Radio, Coins, Users, Disc3 } from 'lucide-react';

interface RightSidebarProps {
  queue: Track[];
  currentTrack: Track;
  onSelectTrack: (track: Track) => void;
  radioStations: RadioStation[];
  onSelectRadio: (station: RadioStation) => void;
  onOpenTipModal: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  queue,
  currentTrack,
  onSelectTrack,
  radioStations,
  onSelectRadio,
  onOpenTipModal
}) => {
  return (
    <aside className="w-80 bg-[#080B12] border-l border-[#1B2232] flex flex-col p-5 select-none shrink-0 h-full overflow-y-auto space-y-6">
      {/* Quick Artist Tip Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121927] to-[#0E131F] border border-[#20293D] shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <Coins size={13} />
            Direct Fan Tipping
          </span>
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
            Solana Devnet
          </span>
        </div>
        <p className="text-xs text-gray-300 font-medium mb-3">
          Appreciate &ldquo;{currentTrack.title}&rdquo; by {currentTrack.artist} with instant on-chain SOL.
        </p>
        <button
          onClick={onOpenTipModal}
          className="w-full py-2 px-3 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
        >
          <Coins size={14} />
          Tip Artist (0.1 SOL)
        </button>
      </div>

      {/* Up Next Queue */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Disc3 size={14} className="text-emerald-400" />
            Up Next In Queue
          </h3>
          <span className="text-[11px] text-gray-400">{queue.length} tracks</span>
        </div>

        <div className="space-y-1.5">
          {queue.slice(0, 4).map((track) => {
            const isPlayingThis = track.id === currentTrack.id;
            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                  isPlayingThis
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                    : 'bg-[#0E121B] border border-transparent hover:border-[#1E273C] text-gray-300 hover:text-white'
                }`}
              >
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold truncate">{track.title}</h4>
                  <p className="text-[11px] text-gray-400 truncate">{track.artist}</p>
                </div>
                <div className="p-1.5 rounded-lg text-gray-400 hover:text-white">
                  <Play size={13} fill={isPlayingThis ? 'currentColor' : 'none'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Radio Stations Tuner */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Radio size={14} className="text-emerald-400" />
            Live Radio Stations
          </h3>
          <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">
            24/7 ON AIR
          </span>
        </div>

        <div className="space-y-2">
          {radioStations.slice(0, 4).map((station) => (
            <div
              key={station.id}
              onClick={() => onSelectRadio(station)}
              className="p-3 rounded-xl bg-[#0E121B] border border-[#1E273C] hover:border-emerald-500/40 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {station.name}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Users size={10} />
                  {station.listenersCount.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-1">{station.tagline}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#182030] text-[10px] text-gray-400">
                <span>{station.bitRate}</span>
                <span className="text-emerald-400 font-semibold group-hover:underline">
                  Tune In &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

