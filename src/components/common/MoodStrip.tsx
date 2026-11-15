import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { MOOD_PRESETS, getMoodLabel } from '../../services/recommendationEngine';
import type { MoodPreset } from '../../types';

interface MoodStripProps {
  activeMood: MoodPreset;
  onSelectMood: (mood: MoodPreset) => void;
  wrap?: boolean;
  compact?: boolean;
  testIdPrefix?: string;
}

/** Shared mood and vibe pill selector reused across Search, Discover, and Top Bar Discovery. */
export function MoodStrip({
  activeMood,
  onSelectMood,
  wrap = false,
  compact = false,
  testIdPrefix = 'mood-pill'
}: MoodStripProps) {
  const { t } = useAppPreferences();

  return (
    <div
      className={
        wrap
          ? 'flex flex-wrap items-center gap-1.5'
          : 'flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1'
      }
    >
      {MOOD_PRESETS.map((preset) => {
        const isSelected = activeMood === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            data-testid={`${testIdPrefix}-${preset.id}`}
            onClick={() => onSelectMood(preset.id)}
            className={`${
              compact ? 'min-h-[28px] px-2.5 py-1 text-[11px]' : 'min-h-[34px] px-3.5 py-1.5 text-xs'
            } rounded-full font-semibold shrink-0 cursor-pointer border transition-colors ${
              isSelected
                ? 'bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] border-transparent'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)]'
            }`}
          >
            {getMoodLabel(preset.id, t)}
          </button>
        );
      })}
    </div>
  );
}
