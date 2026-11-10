import React from 'react';
import type { RadioStation } from '../../types';
import { Radio, Users, Play, Activity } from 'lucide-react';

interface RadioViewProps {
  stations: RadioStation[];
  onSelectStation: (station: RadioStation) => void;
  activeStationId?: string;
}

export const RadioView: React.FC<RadioViewProps> = ({
  stations,
  onSelectStation,
  activeStationId
}) => {
  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0E1320] to-[#0A0D15] border border-[#1E2638] flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 mb-2">
            <Radio size={13} className="animate-pulse" />
            <span>24/7 GLOBAL STREAMS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Live Radio Stations</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-lg">
            Continuous curated transmissions broadcast in lossless master audio. Select any station to tune in immediately.
          </p>
        </div>
      </div>

      {/* Grid of Stations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((st) => {
          const isActive = st.id === activeStationId;
          return (
            <div
              key={st.id}
              onClick={() => onSelectStation(st)}
              className={`p-5 rounded-2xl bg-[#0D111A] border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-1 ${
                isActive
                  ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10'
                  : 'border-[#1B2232] hover:border-[#2C3850]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono border"
                    style={{
                      backgroundColor: `${st.color}15`,
                      borderColor: `${st.color}40`,
                      color: st.color
                    }}
                  >
                    {st.genre}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                    <Users size={12} className="text-emerald-400" />
                    <span>{st.listenersCount.toLocaleString()}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {st.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{st.tagline}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#182030] flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                  <Activity size={12} className="text-emerald-400" />
                  {st.bitRate}
                </span>

                <button className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-1.5">
                  <Play size={12} fill="currentColor" />
                  <span>Tune In</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

