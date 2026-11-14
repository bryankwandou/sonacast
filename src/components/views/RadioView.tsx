import React from 'react';
import type { RadioStation } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
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
  const { t } = useAppPreferences();

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div
        className="p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] flex items-center justify-between transition-colors"
        style={{ background: 'var(--hero-gradient)', boxShadow: 'var(--card-shadow)' }}
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold border border-[var(--accent-border)] mb-2">
            <Radio size={13} className="animate-pulse" />
            <span>24/7 GLOBAL STREAMS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">{t.navRadio}</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            {t.pillar4Desc}
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
              className={`p-5 rounded-2xl bg-[var(--bg-surface)] border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-0.5 ${
                isActive
                  ? 'border-[var(--accent-emerald)] shadow-lg'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
              }`}
              style={isActive ? { boxShadow: '0 8px 24px var(--accent-soft)' } : undefined}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono border"
                    style={{
                      backgroundColor: `${st.color}18`,
                      borderColor: `${st.color}45`,
                      color: st.color
                    }}
                  >
                    {st.genre}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] font-mono">
                    <Users size={12} className="text-[var(--accent-text)]" />
                    <span>{st.listenersCount.toLocaleString()}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[var(--text-primary)] transition-colors">
                  {st.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{st.tagline}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-dim)] font-mono flex items-center gap-1">
                  <Activity size={12} className="text-[var(--accent-text)]" />
                  {st.bitRate}
                </span>

                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)] text-xs font-bold hover:bg-[var(--accent-emerald)] hover:text-[var(--accent-fg)] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={12} fill="currentColor" />
                  <span>{t.tuneIn}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

