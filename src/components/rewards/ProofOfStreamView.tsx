import React, { useState, useEffect } from 'react';
import { solanaService } from '../../services/solanaService';
import type { ProofOfStreamRecord } from '../../types';
import { Activity, ShieldCheck, ArrowUpRight, Award, Clock } from 'lucide-react';

interface ProofOfStreamViewProps {
  currentTrackTitle: string;
  currentArtist: string;
  isPlaying: boolean;
}

export const ProofOfStreamView: React.FC<ProofOfStreamViewProps> = ({
  currentTrackTitle,
  currentArtist,
  isPlaying
}) => {
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [records, setRecords] = useState<ProofOfStreamRecord[]>([]);

  // Periodically record proof of stream during active playback
  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setListenedSeconds((prev) => {
          const next = prev + 1;
          if (next % 10 === 0) {
            solanaService.recordProofOfStream('current', currentTrackTitle, currentArtist, 10);
            setRecords([...solanaService.getProofOfStreamHistory()]);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackTitle, currentArtist]);

  useEffect(() => {
    setRecords(solanaService.getProofOfStreamHistory());
  }, []);

  const totalEarned = records.reduce((acc, r) => acc + r.earnedRewardSol, 0);

  return (
    <div className="w-full h-full min-h-[420px] bg-[var(--bg-surface)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] p-5 sm:p-6 text-[var(--text-primary)] select-none flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)] mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Proof-of-Stream Protocol</h3>
            <p className="text-xs text-[var(--text-secondary)]">Cryptographically Verified Audio Playback &amp; Listener Rewards</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs text-[var(--accent-text)] font-semibold">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
          <span>Active Devnet Oracle</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Clock size={13} className="text-[var(--accent-text)]" />
            Session Stream Time
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
            {Math.floor(listenedSeconds / 60)}m {listenedSeconds % 60}s
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            {isPlaying ? 'Logging active audio packets...' : 'Stream paused'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Award size={13} className="text-[var(--accent-text)]" />
            Accrued Listener SOL
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--accent-text)]">
            +{totalEarned.toFixed(6)} SOL
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            0.00005 SOL / 10s verified audio
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[var(--accent-text)]" />
            Attestation Consensus
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
            100% Validated
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            Devnet block finality ~400ms
          </span>
        </div>
      </div>

      {/* Attestation Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-app)]">
        <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] grid grid-cols-12 gap-2 min-w-[460px]">
          <span className="col-span-4">Track / Artist</span>
          <span className="col-span-3">Duration</span>
          <span className="col-span-2">Reward</span>
          <span className="col-span-3 text-right">Devnet Signature</span>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-dim)]">
            No stream attestations yet. Press Play to begin earning verified listener rewards.
          </div>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="p-3 border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] grid grid-cols-12 gap-2 items-center hover:bg-[var(--bg-hover)] min-w-[460px]"
            >
              <div className="col-span-4 truncate">
                <span className="font-semibold text-[var(--text-primary)] block truncate">{r.trackTitle}</span>
                <span className="text-[11px] text-[var(--text-dim)]">{r.artist}</span>
              </div>
              <span className="col-span-3 text-[var(--text-dim)]">{r.secondsListened}s verified</span>
              <span className="col-span-2 text-[var(--accent-text)] font-bold">+{r.earnedRewardSol} SOL</span>
              <div className="col-span-3 text-right">
                <a
                  href={`https://explorer.solana.com/tx/${r.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-dim)] hover:text-[var(--accent-text)] underline"
                >
                  <span>{r.txSignature?.slice(0, 8)}...</span>
                  <ArrowUpRight size={11} />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

