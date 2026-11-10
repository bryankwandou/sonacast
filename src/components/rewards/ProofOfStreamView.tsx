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
    <div className="w-full h-full min-h-[460px] bg-[#0A0D15] rounded-2xl overflow-hidden border border-[#1E2433] p-6 text-white select-none flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1A2030] mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold">Proof-of-Stream Protocol</h3>
            <p className="text-xs text-gray-400">Cryptographically Verified Audio Playback & Listener Rewards</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Devnet Oracle</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[#121622] border border-[#1E2638]">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Clock size={13} className="text-emerald-400" />
            Session Stream Time
          </span>
          <div className="text-xl font-bold mt-1 text-white">
            {Math.floor(listenedSeconds / 60)}m {listenedSeconds % 60}s
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            {isPlaying ? 'Logging active audio packets...' : 'Stream paused'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#121622] border border-[#1E2638]">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <Award size={13} className="text-emerald-400" />
            Accrued Listener SOL
          </span>
          <div className="text-xl font-bold mt-1 text-emerald-400">
            +{totalEarned.toFixed(6)} SOL
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            0.00005 SOL / 10s verified audio
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#121622] border border-[#1E2638]">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400" />
            Attestation Consensus
          </span>
          <div className="text-xl font-bold mt-1 text-white">
            100% Validated
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">
            Devnet block finality ~400ms
          </span>
        </div>
      </div>

      {/* Attestation Table */}
      <div className="flex-1 overflow-y-auto border border-[#1E2638] rounded-xl bg-[#0D111A]">
        <div className="p-3 bg-[#131826] border-b border-[#1E2638] text-xs font-semibold text-gray-300 grid grid-cols-12 gap-2">
          <span className="col-span-4">Track / Artist</span>
          <span className="col-span-3">Duration</span>
          <span className="col-span-2">Reward</span>
          <span className="col-span-3 text-right">Devnet Signature</span>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            No stream attestations yet. Press Play to begin earning verified listener rewards.
          </div>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="p-3 border-b border-[#1A2030] text-xs text-gray-300 grid grid-cols-12 gap-2 items-center hover:bg-[#121724]"
            >
              <div className="col-span-4 truncate">
                <span className="font-semibold text-white block truncate">{r.trackTitle}</span>
                <span className="text-[11px] text-gray-400">{r.artist}</span>
              </div>
              <span className="col-span-3 text-gray-400">{r.secondsListened}s verified</span>
              <span className="col-span-2 text-emerald-400 font-bold">+{r.earnedRewardSol} SOL</span>
              <div className="col-span-3 text-right">
                <a
                  href={`https://explorer.solana.com/tx/${r.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-emerald-400 underline"
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

