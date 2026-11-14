import React, { useState, useEffect } from 'react';
import { solanaService } from '../../services/solanaService';
import type { TipRecord } from '../../types';
import { Wallet, Coins, ArrowUpRight, Copy, Check, RefreshCw, X, ShieldCheck } from 'lucide-react';

interface SolanaWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeArtistName?: string;
  activeArtistAddress?: string;
  activeTrackTitle?: string;
}

export const SolanaWalletModal: React.FC<SolanaWalletModalProps> = ({
  isOpen,
  onClose,
  activeArtistName = 'Kaelen Brooks',
  activeArtistAddress = '8wJ1Ksp7G2bQyN1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
  activeTrackTitle = 'Midnight Horizon'
}) => {
  const [balance, setBalance] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [tipAmount, setTipAmount] = useState(0.1);
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState<TipRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const publicKey = solanaService.getPublicKey();

  const refreshBalance = async () => {
    const bal = await solanaService.fetchBalance();
    setBalance(bal);
  };

  useEffect(() => {
    if (isOpen) {
      refreshBalance();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAirdrop = async () => {
    setIsAirdropping(true);
    setErrorMessage('');
    try {
      await solanaService.requestAirdrop(1);
      await refreshBalance();
    } catch {
      setErrorMessage('Airdrop failed. Please retry.');
    } finally {
      setIsAirdropping(false);
    }
  };

  const handleSendTip = async () => {
    setIsTipping(true);
    setErrorMessage('');
    setTipSuccess(null);
    try {
      const record = await solanaService.sendArtistTip(
        activeArtistAddress,
        activeArtistName,
        activeTrackTitle,
        tipAmount
      );
      setTipSuccess(record);
      await refreshBalance();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Tip transfer failed.');
      }
    } finally {
      setIsTipping(false);
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-2xl p-5 sm:p-6 shadow-2xl text-[var(--text-primary)] select-none">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Solana Devnet Wallet</h3>
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
              <ShieldCheck size={12} className="text-[var(--accent-text)]" />
              Direct Micro-Settlement Protocol
            </p>
          </div>
        </div>

        {/* Wallet Address Bar */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 rounded-xl mb-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[var(--text-dim)] block">Your Connected Address</span>
            <span className="text-xs font-mono font-medium text-[var(--accent-text)]">
              {truncateAddress(publicKey)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-[var(--accent-text)]" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-[var(--accent-soft)] border border-[var(--accent-border)] p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs text-[var(--text-secondary)]">Devnet Balance</span>
            <div className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-1.5 mt-0.5">
              <span>{balance.toFixed(4)}</span>
              <span className="text-[var(--accent-text)] text-sm font-semibold">SOL</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshBalance}
              className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Refresh Balance"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={handleAirdrop}
              disabled={isAirdropping}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-emerald-hover)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isAirdropping ? 'Airdropping...' : '+1 SOL Airdrop'}
            </button>
          </div>
        </div>

        {/* Tip Artist Section */}
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins size={14} className="text-[var(--accent-text)]" />
            Tip Artist ({activeArtistName})
          </h4>
          <p className="text-xs text-[var(--text-dim)] mb-3">
            Send direct on-chain SOL appreciation for &ldquo;{activeTrackTitle}&rdquo;
          </p>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[0.05, 0.1, 0.5, 1.0].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setTipAmount(amt)}
                className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  tipAmount === amt
                    ? 'border-[var(--accent-emerald)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {amt} SOL
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs mb-3">
              {errorMessage}
            </div>
          )}

          {tipSuccess && (
            <div className="p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent-text)] text-xs mb-3 space-y-1">
              <div className="flex items-center gap-1 font-bold text-[var(--text-primary)]">
                <Check size={14} className="text-[var(--accent-text)]" />
                Tip of {tipSuccess.amountSol} SOL confirmed!
              </div>
              <a
                href={`https://explorer.solana.com/tx/${tipSuccess.txSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[var(--accent-text)] underline flex items-center gap-0.5"
              >
                View on Solana Explorer <ArrowUpRight size={11} />
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={handleSendTip}
            disabled={isTipping}
            className="w-full py-2.5 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] font-bold text-sm hover:bg-[var(--accent-emerald-hover)] transition-colors shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isTipping ? 'Signing Transaction...' : `Send ${tipAmount} SOL Tip`}
          </button>
        </div>
      </div>
    </div>
  );
};

