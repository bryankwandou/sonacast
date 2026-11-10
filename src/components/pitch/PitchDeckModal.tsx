import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X
} from 'lucide-react';

interface PitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PitchDeckModal: React.FC<PitchDeckModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      badge: 'SLIDE 1 · VISION',
      title: 'Sonacast: Decentralized Audio & Real-Time Spectrum Engine',
      subtitle: 'Streaming music, synchronized live video, and dynamic visualizer without server transcoding bottlenecks.',
      points: [
        {
          title: 'Client-Side Audio Pipeline',
          desc: 'Leverages browser Web Audio API & WebCodecs to eliminate expensive cloud transcoding farms.'
        },
        {
          title: 'Zero Pre-Render Visualizer',
          desc: 'Integrates real-time Orbwave circular spectrum with synchronized live lyrics directly in canvas at 60 FPS.'
        },
        {
          title: 'Sub-Second Solana Settlement',
          desc: 'Replaces predatory 90-day label royalty delays with instant micro-attestation streaming rewards.'
        }
      ]
    },
    {
      badge: 'SLIDE 2 · THE PROBLEM',
      title: 'The Broken Economics of Modern Audio Streaming',
      subtitle: 'Legacy platforms charge high subscription fees while artists receive fractions of a cent.',
      points: [
        {
          title: 'Unfair Creator Compensation',
          desc: 'Average payout is only $0.003 per stream, requiring 300,000 monthly plays just to survive.'
        },
        {
          title: '15%+ Streaming Bot Fraud',
          desc: 'Legacy metrics are easily spoofed by click farms, siphoning pooled royalties from legitimate indie musicians.'
        },
        {
          title: 'Expensive Transcoding Infrastructure',
          desc: 'Centralized servers burn massive compute pre-rendering waveforms and multi-bitrate streams.'
        }
      ]
    },
    {
      badge: 'SLIDE 3 · THE SOLUTION',
      title: 'High-Performance Browser Architecture',
      subtitle: 'Offloading computation to edge devices while cryptographically verifying playback on Solana.',
      points: [
        {
          title: 'Tri-Mode Player Engine',
          desc: 'Switch instantly between Vinyl Cover Mode, Live Video Stream Mode, and Interactive Orbwave Spectrum.'
        },
        {
          title: 'Synchronized Lyrics & Podcasts',
          desc: 'Millisecond-accurate interactive transcripts enable interactive scrub, auto-scroll, and language translations.'
        },
        {
          title: 'Proof-of-Stream Micro-Rewards',
          desc: 'Listeners earn loyalty tokens for verified listening time, while artists receive 100% direct fan tips.'
        }
      ]
    },
    {
      badge: 'SLIDE 4 · ARCHITECTURE',
      title: 'Technical Implementation & Data Pipeline',
      subtitle: 'Modular client-side audio DSP pipeline running alongside decentralized state channels.',
      points: [
        {
          title: 'Audio Graph & FFT Analysis',
          desc: 'AudioContext -> AnalyserNode (512 bins, 0.82 smoothing) -> Logarithmic frequency grouping -> 60fps Canvas 2D.'
        },
        {
          title: 'Procedural Audio Synthesis',
          desc: 'Custom multi-oscillator polyphonic synth guarantees zero downtime even under offline or restricted networks.'
        },
        {
          title: 'Solana Devnet Program',
          desc: 'Non-custodial micro-transfers via @solana/web3.js with base58 transaction attestations on explorer.'
        }
      ]
    },
    {
      badge: 'SLIDE 5 · BUSINESS MODEL',
      title: 'Multi-Pronged Sustainable Revenue Model',
      subtitle: 'Aligning incentives across indie artists, live radio curators, and listeners.',
      points: [
        {
          title: '0.5% Protocol Routing Fee',
          desc: 'Negligible fee on artist tips and listener micro-rewards sustains devnet & mainnet RPC nodes.'
        },
        {
          title: 'Creator Studio Pro Presets',
          desc: 'Custom visualizer themes, high-fidelity export formats, and exclusive live radio host slots.'
        },
        {
          title: 'On-Chain Music Collectibles',
          desc: 'Limited-edition audio stems, signed vinyl NFTs, and backstage podcast access passes.'
        }
      ]
    },
    {
      badge: 'SLIDE 6 · COMPETITIVE ADVANTAGE',
      title: 'Competitive Matrix vs. Legacy & Web3 Platforms',
      subtitle: 'Why Sonacast outperforms existing streaming services across every metric.',
      points: [
        {
          title: 'Spotify / Apple Music',
          desc: 'Centralized, 90-day payouts, zero video audio reactivity, no on-chain fan tipping.'
        },
        {
          title: 'Audius',
          desc: 'Heavy storage overhead, lacks integrated live video and real-time canvas spectrum transcript overlay.'
        },
        {
          title: 'Sonacast Superiority',
          desc: 'Instant browser execution, 0% server transcoding costs, 3-mode playback, and open Solana interoperability.'
        }
      ]
    }
  ];

  const current = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0B0F19] border border-[#222B3E] rounded-3xl p-8 shadow-2xl text-white select-none">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-[#1A2234] transition-colors"
        >
          <X size={20} />
        </button>

        {/* Slide Counter & Badge */}
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 tracking-wider">
            {current.badge}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            {currentSlide + 1} / {slides.length}
          </span>
        </div>

        {/* Slide Content */}
        <div className="min-h-[340px] flex flex-col justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {current.title}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {current.subtitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {current.points.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#111726] border border-[#1E283C] hover:border-emerald-500/30 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 mb-2 text-emerald-400">
                    <CheckCircle2 size={16} />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{pt.title}</h4>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{pt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-[#1E283C] mt-6">
            <button
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#141C2B] text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1E2A40] transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            {/* Slide Dots Indicator */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentSlide ? 'w-6 bg-emerald-400' : 'bg-gray-700 hover:bg-gray-500'
                    }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlide === slides.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
