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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#0D111A] border border-[#222A3D] rounded-2xl p-6 shadow-2xl text-white select-none">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1A2234] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Solana Devnet Wallet</h3>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              Direct Micro-Settlement Protocol
            </p>
          </div>
        </div>

        {/* Wallet Address Bar */}
        <div className="bg-[#121826] border border-[#1E273C] p-3 rounded-xl mb-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 block">Your Connected Address</span>
            <span className="text-xs font-mono font-medium text-emerald-400">
              {truncateAddress(publicKey)}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#1B2335] text-gray-300 hover:text-white hover:bg-[#253047] transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-[#121A28] border border-emerald-500/20 p-4 rounded-xl mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">Devnet Balance</span>
            <div className="text-2xl font-bold text-white flex items-center gap-1.5 mt-0.5">
              <span>{balance.toFixed(4)}</span>
              <span className="text-emerald-400 text-sm font-semibold">SOL</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshBalance}
              className="p-2 rounded-lg bg-[#1B2335] text-gray-300 hover:text-white transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleAirdrop}
              disabled={isAirdropping}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {isAirdropping ? 'Airdropping...' : '+1 SOL Airdrop'}
            </button>
          </div>
        </div>

        {/* Tip Artist Section */}
        <div className="border-t border-[#1E273C] pt-4">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins size={14} className="text-emerald-400" />
            Tip Artist ({activeArtistName})
          </h4>
          <p className="text-xs text-gray-400 mb-3">
            Send direct on-chain SOL appreciation for &ldquo;{activeTrackTitle}&rdquo;
          </p>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[0.05, 0.1, 0.5, 1.0].map((amt) => (
              <button
                key={amt}
                onClick={() => setTipAmount(amt)}
                className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                  tipAmount === amt
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-[#1E273C] bg-[#121826] text-gray-400 hover:text-white'
                }`}
              >
                {amt} SOL
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs mb-3">
              {errorMessage}
            </div>
          )}

          {tipSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs mb-3 space-y-1">
              <div className="flex items-center gap-1 font-bold text-white">
                <Check size={14} className="text-emerald-400" />
                Tip of {tipSuccess.amountSol} SOL confirmed!
              </div>
              <a
                href={`https://explorer.solana.com/tx/${tipSuccess.txSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 underline flex items-center gap-0.5 hover:text-emerald-300"
              >
                View on Solana Explorer <ArrowUpRight size={11} />
              </a>
            </div>
          )}

          <button
            onClick={handleSendTip}
            disabled={isTipping}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isTipping ? 'Signing Transaction...' : `Send ${tipAmount} SOL Tip`}
          </button>
        </div>
      </div>
    </div>
  );
};

