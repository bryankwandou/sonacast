import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastBannerProps {
  message: string | null;
  tone?: 'default' | 'success' | 'warning';
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({
  message,
  tone = 'default',
  onDismiss
}) => {
  if (!message) return null;

  const icon =
    tone === 'success' ? (
      <CheckCircle2 size={14} className="text-[var(--accent)] shrink-0" />
    ) : tone === 'warning' ? (
      <AlertCircle size={14} className="text-amber-500 shrink-0" />
    ) : (
      <Info size={14} className="text-[var(--accent)] shrink-0" />
    );

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sonacast-toast"
      className="fixed bottom-[128px] sm:bottom-[104px] left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-md pointer-events-auto"
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--border)] shadow-xl text-[12px] font-medium text-[var(--text-primary)]">
        {icon}
        <span className="truncate">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
