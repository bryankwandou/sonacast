import React, { useState, useEffect, useCallback } from 'react';
import { solanaService, PLATFORM_FEE_BPS, ARTIST_SHARE_BPS, type TipLedgerResponse } from '../../services/solanaService';
import type { ProofOfStreamRecord } from '../../types';
import { Activity, ShieldCheck, ArrowUpRight, Award, Clock, Coins, Database } from 'lucide-react';

interface ProofOfStreamViewProps {
  currentTrackTitle: string;
  currentArtist: string;
  isPlaying: boolean;
  listenerId?: string;
  listenerName?: string;
}

export const ProofOfStreamView: React.FC<ProofOfStreamViewProps> = ({
  currentTrackTitle,
  currentArtist,
  isPlaying,
  listenerId = 'anon_listener',
  listenerName = 'Listener'
}) => {
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [posLogs, setPosLogs] = useState<ProofOfStreamRecord[]>([]);
  const [ledger, setLedger] = useState<TipLedgerResponse | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'tips' | 'telemetry'>('tips');

  const refreshLedger = useCallback(async () => {
    try {
      const data = await solanaService.fetchLedger(undefined, listenerId);
      setLedger(data);
      setPosLogs(data.proofOfStream?.logs || []);
    } catch {
      // keep existing UI state on transient offline
    }
  }, [listenerId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshLedger();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refreshLedger]);

  // Periodically persist genuine Proof-of-Stream telemetry rows in Neon Postgres during active playback
  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        setListenedSeconds((prev) => {
          const next = prev + 1;
          if (next % 10 === 0) {
            solanaService
              .recordProofOfStream(listenerId, 'active-stream', currentTrackTitle, currentArtist, 10, listenerName)
              .then((rec) => {
                setPosLogs((curr) => [rec, ...curr].slice(0, 25));
              })
              .catch(() => {});
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackTitle, currentArtist, listenerId, listenerName]);

  const totalPendingUnitsSol =
    ledger?.proofOfStream?.totalEstimatedSol ??
    posLogs.reduce((acc, r) => acc + r.earnedRewardSol, 0);

  return (
    <div className="w-full h-full min-h-[420px] bg-[var(--bg-surface)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] p-5 sm:p-6 text-[var(--text-primary)] select-none flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)] mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Proof-of-Stream &amp; Split Treasury Ledger
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Neon Postgres Stream Telemetry + Solana On-Chain Verified {ARTIST_SHARE_BPS / 100}% /{' '}
              {PLATFORM_FEE_BPS / 100}% Split Receipts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs text-[var(--accent-text)] font-semibold">
          <Database size={13} />
          <span>Neon + {solanaService.getCluster() === 'mainnet-beta' ? 'Mainnet-Beta' : 'Devnet'}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Clock size={13} className="text-[var(--accent-text)]" />
            Active Session Time
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
            {Math.floor(listenedSeconds / 60)}m {listenedSeconds % 60}s
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            {isPlaying ? 'Persisting 10s telemetry batches to Neon...' : 'Playback paused'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Award size={13} className="text-[var(--accent-text)]" />
            Pending Batch Credit
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--accent-text)]">
            +{totalPendingUnitsSol.toFixed(6)} SOL
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            Off-chain pending_batch telemetry (awaiting settlement)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[var(--accent-text)]" />
            Verified Split Tips ({ARTIST_SHARE_BPS / 100}/{PLATFORM_FEE_BPS / 100})
          </span>
          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">
            {(ledger?.summary.totalGrossSol ?? 0).toFixed(4)} SOL
          </div>
          <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
            Fee Treasury: {(ledger?.summary.totalPlatformFeeSol ?? 0).toFixed(4)} SOL &middot; Verified Artists:{' '}
            {ledger?.summary.verifiedArtistsCount ?? 0}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('tips')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
            activeSubTab === 'tips'
              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          <Coins size={13} />
          Verified Tip Receipts ({ledger?.tips.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('telemetry')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
            activeSubTab === 'telemetry'
              ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          <Activity size={13} />
          Stream Telemetry Logs ({posLogs.length})
        </button>
      </div>

      {/* Table */}
      {activeSubTab === 'tips' ? (
        <div className="flex-1 overflow-x-auto overflow-y-auto border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-app)]">
          <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] grid grid-cols-12 gap-2 min-w-[520px]">
            <span className="col-span-4">Artist / Track</span>
            <span className="col-span-3">Split (85% / 15%)</span>
            <span className="col-span-2">Route</span>
            <span className="col-span-3 text-right">Explorer Receipt</span>
          </div>

          {!ledger || ledger.tips.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-dim)]">
              No on-chain tips recorded yet. Open Solana Wallet to send an atomic 85/15 split tip.
            </div>
          ) : (
            ledger.tips.map((tip) => (
              <div
                key={tip.id}
                className="p-3 border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] grid grid-cols-12 gap-2 items-center hover:bg-[var(--bg-hover)] min-w-[520px]"
              >
                <div className="col-span-4 truncate">
                  <span className="font-semibold text-[var(--text-primary)] block truncate">
                    {tip.recipientName}
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)] truncate block">
                    {tip.trackTitle}
                  </span>
                </div>
                <span className="col-span-3 font-mono text-[11px]">
                  <strong className="text-[var(--accent-text)]">{tip.artistShareSol.toFixed(4)}</strong> +{' '}
                  {tip.feeSol.toFixed(4)} SOL
                </span>
                <span className="col-span-2 text-[11px]">
                  {tip.routeType === 'direct_artist' ? 'Direct' : 'Escrow Vault'} &middot; {tip.cluster}
                </span>
                <div className="col-span-3 text-right">
                  <a
                    href={solanaService.getExplorerTxUrl(tip.txSignature, tip.cluster)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--accent-text)] underline"
                  >
                    <span>{tip.txSignature.slice(0, 8)}...</span>
                    <ArrowUpRight size={11} />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-app)]">
          <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] grid grid-cols-12 gap-2 min-w-[460px]">
            <span className="col-span-5">Track / Artist</span>
            <span className="col-span-2">Duration</span>
            <span className="col-span-2">Pending Est.</span>
            <span className="col-span-3 text-right">Batch Status</span>
          </div>

          {posLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-dim)]">
              No stream telemetry batches logged yet. Press Play to log listening intervals in Neon Postgres.
            </div>
          ) : (
            posLogs.map((r) => (
              <div
                key={r.id}
                className="p-3 border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] grid grid-cols-12 gap-2 items-center hover:bg-[var(--bg-hover)] min-w-[460px]"
              >
                <div className="col-span-5 truncate">
                  <span className="font-semibold text-[var(--text-primary)] block truncate">
                    {r.trackTitle}
                  </span>
                  <span className="text-[11px] text-[var(--text-dim)]">{r.artist}</span>
                </div>
                <span className="col-span-2 text-[var(--text-dim)]">{r.secondsListened}s</span>
                <span className="col-span-2 text-[var(--accent-text)] font-bold">
                  +{r.earnedRewardSol}
                </span>
                <div className="col-span-3 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-dim)]">
                    {r.settlementStatus || 'pending_batch'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
