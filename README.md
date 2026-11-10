# Sonacast

> Browser-First Music & Video Streaming, Live Synchronized Lyrics, and Real-Time Orbwave Spectrum Engine on Solana Devnet.

---

## Overview

**Sonacast** is a next-generation decentralized streaming application inspired by platforms like Spotify and Resso, engineered to run entirely inside modern web browsers with zero server transcoding overhead.

### Live Deployments
- **GitHub Pages (Production)**: [https://bryankwandou.github.io/sonacast/](https://bryankwandou.github.io/sonacast/)
- **Local Server**: [http://localhost:4173/](http://localhost:4173/)

Unlike legacy audio platforms that require heavy cloud transcoding clusters and 90-day royalty settlement delays, Sonacast delivers:
- **Tri-Mode Dynamic Stage**: Seamless switching between Vinyl Cover Disc, Live Synchronized Video Stream, and the real-time Orbwave Spectrum Engine.
- **Real-Time Live Synchronized Lyrics & Transcripts**: Rendered directly over the visualizer canvas at 60 FPS without requiring offline video pre-rendering.
- **Web Audio DSP Pipeline**: Real-time 512-bin FFT frequency analysis, logarithmic band grouping, asymmetric peak smoothing, and resilient procedural sound synthesis.
- **Live 24/7 Radio Stations & Podcasts**: Instant tuning into global channels with live listener counts and continuous broadcast feeds.
- **Non-Custodial Solana Devnet Integration**: Direct fan-to-artist SOL tipping, sub-second transaction attestations, and a cryptographic Proof-of-Stream listener rewards protocol.
- **Multilingual Support**: Instant locale switching across English (default), Bahasa Indonesia, Japanese (日本語), Spanish (Español), and German (Deutsch).

---

## Core Architecture

```
[Audio Source / Synth Engine / File Stream]
                    │
                    ▼
          [Web Audio AudioContext]
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
  [Gain Controller]     [AnalyserNode] (FFT 512, 0.82 smoothing)
         │                     │
         ▼                     ▼
  [Audio Hardware]      [Logarithmic Frequency Bins]
                         ├── Sub-bass (30 - 250 Hz)
                         ├── Midrange (250 - 2000 Hz)
                         └── Treble (2000 - 16000 Hz)
                               │
                               ▼
               [Orbwave 2D Canvas Engine]
                 ├── Circular Spectrum Bar Array
                 ├── Reactive Bass Bloom & Particles
                 ├── Rotating Vinyl Texture
                 └── In-Canvas Live Lyrics HUD Overlay
                               │
                               ▼
                 [Solana Devnet Settlement]
                 ├── Instant Artist Tip Transfers
                 └── Proof-of-Stream Block Finality
```

---

## Key Modules

| Module | Location | Description |
|---|---|---|
| **Audio Engine** | `src/services/audioEngine.ts` | Web Audio API wrapper with FFT frequency extraction and procedural chord/bass synthesizer. |
| **Orbwave Canvas** | `src/components/visualizer/OrbwaveCanvas.tsx` | 60 FPS 2D Canvas circular spectrum with integrated live transcript HUD. |
| **Vinyl Cover** | `src/components/player/VinylCover.tsx` | Turntable vinyl presentation with bass-reactive scale and needle tracking. |
| **Video Player** | `src/components/player/VideoPlayer.tsx` | Synchronized live video stream player with ambient backlight. |
| **Live Lyrics** | `src/components/lyrics/LiveLyrics.tsx` | Interactive karaoke transcript with millisecond auto-scroll and click-to-seek. |
| **Solana Service** | `src/services/solanaService.ts` | Non-custodial Devnet wallet manager, airdrop faucet, and tipping transaction builder. |
| **Proof of Stream** | `src/components/rewards/ProofOfStreamView.tsx` | Attestation ledger tracking verified listening time and micro-rewards. |
| **Pitch Deck** | `src/components/pitch/PitchDeckModal.tsx` | Interactive 6-slide Silicon Valley investor presentation. |

---

## Quickstart

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
git clone https://github.com/bryankwandou/sonacast.git
cd sonacast
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

---

## License
MIT
