import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  Wallet,
  X
} from 'lucide-react';
import type { AuthProvidersMeta, AuthUser } from '../../types';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { loginWithNeon, registerWithNeon } from '../../services/authService';
import { getOrCreateListenerIdentity } from '../../services/neonSyncService';
import { getPrivyAppId, isPrivyClientEnabled, submitPrivyTokenToBackend } from '../../services/privyService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  authProviders?: AuthProvidersMeta;
  isCloudConnected: boolean;
  onAuthSuccess: (user: AuthUser) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  onOpenLibrary?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  authUser,
  authProviders,
  isCloudConnected,
  onAuthSuccess,
  onLogout,
  onOpenLibrary
}) => {
  const { t } = useAppPreferences();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [privyTokenInput, setPrivyTokenInput] = useState('');
  const [isVerifyingPrivy, setIsVerifyingPrivy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const privyActive = isPrivyClientEnabled(authProviders);
  const privyAppId = getPrivyAppId(authProviders);

  const handleClose = useCallback(() => {
    setErrorMsg('');
    setPrivyTokenInput('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'register' && displayName.trim().length < 2) {
      setErrorMsg('Display name must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        const guest = getOrCreateListenerIdentity();
        const res = await registerWithNeon({
          email: trimmedEmail,
          password,
          displayName: displayName.trim(),
          guestListenerId: guest.listenerId
        });
        if (!res.ok || !res.user) {
          setErrorMsg(res.error || 'Could not create account.');
          return;
        }
        await onAuthSuccess(res.user);
        setPassword('');
        handleClose();
      } else {
        const res = await loginWithNeon({
          email: trimmedEmail,
          password
        });
        if (!res.ok || !res.user) {
          setErrorMsg(res.error || 'Invalid email or password.');
          return;
        }
        await onAuthSuccess(res.user);
        setPassword('');
        handleClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrivyVerifySubmit = async () => {
    const token = privyTokenInput.trim();
    if (!token) {
      setErrorMsg('Enter a valid Privy identity/access token to sign in.');
      return;
    }
    setErrorMsg('');
    setIsVerifyingPrivy(true);
    try {
      const guest = getOrCreateListenerIdentity();
      const res = await submitPrivyTokenToBackend({
        accessToken: token,
        guestListenerId: guest.listenerId
      });
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Privy verification failed.');
        return;
      }
      await onAuthSuccess(res.user);
      setPrivyTokenInput('');
      handleClose();
    } finally {
      setIsVerifyingPrivy(false);
    }
  };

  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try {
      await onLogout();
      handleClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.authAccountLabel}
      data-testid="auth-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-text)]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                {authUser ? t.authAccountLabel : mode === 'login' ? t.authSignIn : t.authSignUp}
              </h2>
              <p className="text-[11px] text-[var(--text-dim)]">
                Neon Postgres Authentication &amp; Cloud Sync
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label={t.closeLabel}
            data-testid="auth-modal-close"
            className="w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {authUser ? (
            /* Authenticated Account View */
            <div data-testid="auth-signed-in-view" className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-extrabold text-sm flex items-center justify-center shrink-0">
                    {authUser.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                      {authUser.displayName}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {authUser.email || authUser.embeddedSolanaWallet || authUser.listenerId}
                    </div>
                  </div>
                </div>

                {authUser.embeddedSolanaWallet && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
                      <Wallet size={12} className="text-[var(--accent-text)]" />
                      <span>Solana Wallet</span>
                    </span>
                    <span className="font-mono text-[var(--text-primary)]">
                      {authUser.embeddedSolanaWallet.slice(0, 6)}...{authUser.embeddedSolanaWallet.slice(-4)}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-[var(--accent-text)] font-semibold">
                    <CheckCircle2 size={13} />
                    <span>{isCloudConnected ? t.cloudSyncedLabel : 'Neon Account Active'}</span>
                  </span>
                  <span className="font-mono text-[var(--text-dim)] truncate max-w-[160px]">
                    {authUser.listenerId}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {onOpenLibrary && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenLibrary();
                      handleClose();
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Cloud size={14} className="text-[var(--accent-text)]" />
                    <span>{t.navFavorites}</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="auth-logout-btn"
                  disabled={isSigningOut}
                  onClick={handleSignOutClick}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-400 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSigningOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  <span>{t.authSignOut}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Register View */
            <>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <button
                  type="button"
                  data-testid="auth-tab-login"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <LogIn size={13} />
                  <span>{t.authSignIn}</span>
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-register"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[var(--accent-emerald)] text-[var(--accent-fg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <UserPlus size={13} />
                  <span>{t.authSignUp}</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'register' && (
                  <div className="space-y-1">
                    <label
                      htmlFor="auth-display-name"
                      className="block text-[11px] font-bold text-[var(--text-secondary)]"
                    >
                      {t.authNameLabel}
                    </label>
                    <div className="relative">
                      <User
                        size={14}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                      />
                      <input
                        id="auth-display-name"
                        data-testid="auth-input-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ari Pratama"
                        autoComplete="name"
                        className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="auth-email"
                    className="block text-[11px] font-bold text-[var(--text-secondary)]"
                  >
                    {t.authEmailLabel}
                  </label>
                  <div className="relative">
                    <Mail
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                    />
                    <input
                      id="auth-email"
                      data-testid="auth-input-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      autoComplete="email"
                      className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-[11px] font-bold text-[var(--text-secondary)]"
                  >
                    {t.authPasswordLabel}
                  </label>
                  <div className="relative">
                    <Lock
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                    />
                    <input
                      id="auth-password"
                      data-testid="auth-input-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    data-testid="auth-error-msg"
                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-medium"
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="auth-submit-btn"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] disabled:opacity-60 text-[var(--accent-fg)] text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{mode === 'login' ? t.authSignIn : t.authSignUp}</span>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  OAuth
                </span>
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>

              {/* Google Sign-In (Explicitly Marked Coming Soon) */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  data-testid="auth-google-coming-soon"
                  className="w-full min-h-[46px] px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] opacity-75 cursor-not-allowed flex items-center justify-between gap-3"
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.08.72-2.47 1.15-4.23 1.15-3.25 0-6.01-2.19-7-5.14H1.01v3.14C3.03 21.15 7.21 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5 14c-.25-.72-.39-1.5-.39-2.3 0-.8.14-1.58.39-2.3V6.26H1.01A11.96 11.96 0 0 0 0 11.7c0 1.94.46 3.77 1.01 5.44L5 14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.76c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.08 1.19 15.3 0 12 0 7.21 0 3.03 2.85 1.01 6.86L5 10c.99-2.95 3.75-5.24 7-5.24Z"
                      />
                    </svg>
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {t.authGoogleCta}
                    </span>
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)] shrink-0">
                    {t.authGoogleComingSoon}
                  </span>
                </button>
                <p className="text-[11px] text-[var(--text-dim)] px-1 leading-relaxed">
                  {t.authGoogleDesc}
                </p>
              </div>

              {/* Privy Email OTP & Embedded Solana Wallet (hidden until PRIVY_APP_ID & PRIVY_APP_SECRET are set) */}
              {privyActive && (
                <div
                  data-testid="auth-privy-panel"
                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--accent-border)] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      <Wallet size={14} className="text-[var(--accent-text)]" />
                      <span>Privy Email &amp; Solana Wallet</span>
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">
                      {privyAppId?.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={privyTokenInput}
                      onChange={(e) => setPrivyTokenInput(e.target.value)}
                      placeholder="Privy verified JWT token"
                      aria-label="Privy access token"
                      className="flex-1 min-h-[40px] px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)]"
                    />
                    <button
                      type="button"
                      disabled={isVerifyingPrivy}
                      onClick={handlePrivyVerifySubmit}
                      className="min-h-[40px] px-3.5 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      {isVerifyingPrivy ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

