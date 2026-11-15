import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_ITEMS: { keyLabel: string; description: string }[] = [
  { keyLabel: 'Space', description: 'Play / Pause current full-length track' },
  { keyLabel: '/', description: 'Focus global catalog search bar (or Ctrl+K)' },
  { keyLabel: 'Right Arrow', description: 'Skip to next pure-algorithm recommendation' },
  { keyLabel: 'Left Arrow', description: 'Return to previous track in session history' },
  { keyLabel: 'Up / Down', description: 'Switch tracks vertically in Vibe Feed' },
  { keyLabel: 'L', description: 'Toggle Favorite (synced to Neon Postgres)' },
  { keyLabel: 'A', description: 'Open Add to Album & Personal Note sheet' },
  { keyLabel: 'B', description: 'Open Blend Music studio' },
  { keyLabel: 'F', description: 'Open Favorites & Custom Albums hub' },
  { keyLabel: 'M', description: 'Mute / Unmute audio output' },
  { keyLabel: 'S', description: 'Toggle Shuffle mode' },
  { keyLabel: 'R', description: 'Cycle Repeat mode (Off / All / One)' },
  { keyLabel: '?', description: 'Open or close Keyboard Shortcuts' }
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useAppPreferences();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.keyboardShortcutsLabel}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
            <Keyboard size={16} className="text-[var(--accent-text)]" />
            <span>{t.keyboardShortcutsLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeLabel}
            className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 divide-y divide-[var(--border-subtle)] max-h-[70vh] overflow-y-auto">
          {SHORTCUT_ITEMS.map((item) => (
            <div key={item.keyLabel} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <span className="text-[var(--text-secondary)]">{item.description}</span>
              <kbd className="px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] font-mono text-[11px] font-semibold text-[var(--text-primary)] shrink-0">
                {item.keyLabel}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

