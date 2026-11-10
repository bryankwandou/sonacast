import type { Track, PodcastEpisode, RadioStation } from '../types';

export const TRACK_CATALOG: Track[] = [
  {
    id: 'track-1',
    title: 'Midnight Horizon',
    artist: 'Kaelen Brooks',
    album: 'Synthetic Solitude',
    duration: 194,
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
    genre: 'Synthwave',
    bpm: 120,
    artistSolanaAddress: '8wJ1Ksp7G2bQyN1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Scanning the empty avenues under violet light' },
      { time: 8, text: 'Analog synthesizer hums across the digital divide' },
      { time: 16, text: 'Feel the frequency vibrating through the dashboard' },
      { time: 24, text: 'Accelerating toward the edge of what we knew before' },
      { time: 32, text: 'Night lights blur into streaming vectors of code' },
      { time: 40, text: 'We found our sanctuary on this open endless road' },
      { time: 48, text: 'No latency in our connection, no echoes of yesterday' },
      { time: 56, text: 'Let the bassline sweep every phantom shadow away' },
      { time: 66, text: 'Resonance builds inside the core of the machine' },
      { time: 74, text: 'The purest transmission this city has ever seen' },
      { time: 82, text: 'Catch the wave before the morning signals break' },
      { time: 90, text: 'Alive in every calculated frequency we make' },
      { time: 100, text: 'Hold the frequency steady till the skyline glows' },
      { time: 110, text: 'Where the midnight horizon finally overflows' }
    ]
  },
  {
    id: 'track-2',
    title: 'Neon Echoes',
    artist: 'Cygnus & Lyra',
    album: 'Constellation Vector',
    duration: 212,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-colored-smoke-effect-in-slow-motion-41846-large.mp4',
    genre: 'Cyberpunk Chill',
    bpm: 112,
    artistSolanaAddress: '5pL9Nx3b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Rain drops striking holographic displays on glass' },
      { time: 9, text: 'Reflecting memories of analog times that pass' },
      { time: 18, text: 'Whispers routed through fiber strands deep underground' },
      { time: 27, text: 'Searching for a warm human frequency yet unfound' },
      { time: 36, text: 'Neon echoes pulse across the concrete maze' },
      { time: 45, text: 'Lost in the digital luminescence and quiet haze' },
      { time: 54, text: 'Synchronize your heartbeat with the clock of the net' },
      { time: 63, text: 'The cleanest cadence we have discovered yet' },
      { time: 72, text: 'Decentralized dreams in every line we render' },
      { time: 82, text: 'A gentle spectrum soft, resilient and tender' }
    ]
  },
  {
    id: 'track-3',
    title: 'Velvet Raindrops',
    artist: 'Maya Lin',
    album: 'Coffee & Analog Tapes',
    duration: 178,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-blurred-street-lights-on-a-rainy-night-41818-large.mp4',
    genre: 'Lo-Fi Jazz',
    bpm: 84,
    artistSolanaAddress: '3mK8Rx9b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Steam rising from an untouched ceramic cup' },
      { time: 10, text: 'Watching the quiet morning street waking up' },
      { time: 20, text: 'Gentle vinyl crackle breathing through the speaker cone' },
      { time: 30, text: 'A tranquil room where solitude feels like home' },
      { time: 40, text: 'Raindrops tap a gentle rhumba on the windowsill' },
      { time: 50, text: 'Time suspended in a groove completely still' },
      { time: 60, text: 'Muted trumpet floating over warm Rhodes chords' },
      { time: 70, text: 'Expressing feelings far beyond everyday words' },
      { time: 82, text: 'Just stay right here while the drizzle softly falls' }
    ]
  },
  {
    id: 'track-4',
    title: 'Orbital Drift',
    artist: 'Sector 7',
    album: 'Deep Telemetry',
    duration: 236,
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-star-cluster-movement-in-outer-space-41617-large.mp4',
    genre: 'Deep Ambient',
    bpm: 72,
    artistSolanaAddress: '9rQ4Fx2b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Approaching the outer edge of low planetary orbit' },
      { time: 12, text: 'Silence so immense only sub-bass can absorb it' },
      { time: 24, text: 'Beacon signals blinking blue every sixteen bars' },
      { time: 36, text: 'Suspended midway between the Earth and ancient stars' },
      { time: 48, text: 'Telemetry streams down in crystalline cascading packets' },
      { time: 60, text: 'Weightless floating above magnetic weather brackets' },
      { time: 72, text: 'Listen to the cosmic background radiation sigh' },
      { time: 84, text: 'Drifting gently across the endless dark velvet sky' }
    ]
  },
  {
    id: 'track-5',
    title: 'Subterranean Pulse',
    artist: 'Vesper Pulse',
    album: 'Berlin Vault Sessions',
    duration: 198,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-flashing-tunnel-lights-41838-large.mp4',
    genre: 'Modular Techno',
    bpm: 132,
    artistSolanaAddress: '7tY9Vx4b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Concrete resonance deep beneath the city grid' },
      { time: 8, text: 'Unlocking rhythmic patterns once securely hid' },
      { time: 16, text: 'Kick drum impacts with three hundred joules of force' },
      { time: 24, text: 'Tracking the acoustic vibration back to its origin source' },
      { time: 32, text: 'Strobe light flashes slicing through the dry ice air' },
      { time: 40, text: 'A thousand minds united in an unshakeable trance out there' },
      { time: 48, text: 'Keep the 909 running without interruption or cease' },
      { time: 56, text: 'Pure mechanical rhythm bringing spiritual release' }
    ]
  },
  {
    id: 'track-6',
    title: 'Solana Sunset',
    artist: 'Solarium Collective',
    album: 'Proof of Groove',
    duration: 186,
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-waves-crashing-on-a-beach-41619-large.mp4',
    genre: 'Tropical Chill',
    bpm: 98,
    artistSolanaAddress: '2uB7Kx5b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    lyrics: [
      { time: 0, text: 'Warm golden breeze touching the shoreline palms' },
      { time: 10, text: 'Unwinding after hours with soothing ocean balms' },
      { time: 20, text: 'Four hundred milliseconds to finalize the sunset' },
      { time: 30, text: 'The most tranquil vista our eyes have noticed yet' },
      { time: 40, text: 'Bassline rolling smooth like the evening surf rolling in' },
      { time: 50, text: 'Where the warmth of the sun and the night begin' },
      { time: 60, text: 'Raise a glass to open code and decentralized sound' },
      { time: 70, text: 'True community harmony forever easily found' }
    ]
  }
];

export const PODCAST_CATALOG: PodcastEpisode[] = [
  {
    id: 'pod-1',
    title: 'Architecting High-Throughput Media Protocols',
    host: 'Dr. Marcus Vance',
    podcastName: 'Silicon Valley Tech Horizon',
    duration: 310,
    coverUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-recording-studio-with-microphone-and-mixer-41828-large.mp4',
    description: 'Deep dive into decentralized CDN networks, browser-side audio rendering pipelines, and sub-second micropayment settlement.',
    episodeNumber: 42,
    hostSolanaAddress: '8wJ1Ksp7G2bQyN1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    transcript: [
      { time: 0, text: 'Welcome back to Tech Horizon. Today we dissect browser-first audio streaming.' },
      { time: 8, text: 'For years, audio streaming meant heavy server transcoding clusters.' },
      { time: 16, text: 'With modern WebCodecs and the Web Audio API, decoding is shifted client-side.' },
      { time: 25, text: 'Why push raw audio frames when client devices have multi-gigahertz processors?' },
      { time: 35, text: 'When you eliminate transcoding bottlenecks, latency drops below human perception.' },
      { time: 45, text: 'Coupled with high-speed blockchain state channels, micro-royalties happen per beat.' },
      { time: 55, text: 'Artists receive transparent settlements without 90-day label delays.' },
      { time: 65, text: 'This represents a structural paradigm shift for content distribution.' }
    ]
  },
  {
    id: 'pod-2',
    title: 'Real-Time Audio Reactivity & Spectrum Math',
    host: 'Sarah Jenkins & Kaito Tanaka',
    podcastName: 'DSP & Modern Web',
    duration: 285,
    coverUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-sound-board-in-a-music-recording-studio-41830-large.mp4',
    description: 'Examining Blackman-Harris windowing, logarithmic frequency bucketing, and 60fps canvas spectrum algorithms.',
    episodeNumber: 18,
    hostSolanaAddress: '5pL9Nx3b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    transcript: [
      { time: 0, text: 'Today on DSP & Modern Web: the mathematics behind visual spectrum rings.' },
      { time: 9, text: 'Human hearing perceives pitch on a logarithmic scale, not linear.' },
      { time: 18, text: 'If your FFT renders linear frequency bins, the low end looks starved.' },
      { time: 28, text: 'We allocate 60 percent of visual canvas bins to 30 hertz through 2 kilohertz.' },
      { time: 38, text: 'Adding asymmetric peak smoothing preserves snappy transient attack.' },
      { time: 48, text: 'While allowing gentle release envelopes that feel organic to the eye.' },
      { time: 58, text: 'No video pre-rendering needed; everything computes dynamically in real-time.' }
    ]
  },
  {
    id: 'pod-3',
    title: 'The Creator Economy on High-Speed Blockchains',
    host: 'Devon Miller',
    podcastName: 'Decentralized Audio Journal',
    duration: 330,
    coverUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=800&auto=format&fit=crop',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-recording-studio-with-microphone-and-mixer-41828-large.mp4',
    description: 'How verifiable on-chain stream proofs replace fraudulent streaming bots and ensure authentic listener compensation.',
    episodeNumber: 64,
    hostSolanaAddress: '3mK8Rx9b7C2eR1M8Fv4D5aPq3h9xR7kZ2mVc4T6nYbE',
    transcript: [
      { time: 0, text: 'Streaming platforms report up to 15 percent fraudulent bot plays.' },
      { time: 9, text: 'Proof-of-Stream cryptographically binds playback session hashes with client entropy.' },
      { time: 19, text: 'Each 30 seconds of verified audio listening signs a micro-attestation.' },
      { time: 29, text: 'Listeners accumulate loyalty tokens while artists receive direct compensation.' },
      { time: 40, text: 'By removing predatory middlemen, indie musicians thrive on smaller dedicated fanbases.' },
      { time: 50, text: 'The economics align incentives for quality rather than algorithmic clickbait.' }
    ]
  }
];

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'station-1',
    name: 'Subspace Cyberwave',
    tagline: '24/7 Neon Synthwave, Cyberpunk Dystopia & Dark Synth',
    genre: 'Synthwave',
    bitRate: '320 kbps FLAC',
    listenersCount: 14290,
    color: '#06B6D4',
    accentColor: '#3B82F6',
    currentTrack: TRACK_CATALOG[0]
  },
  {
    id: 'station-2',
    name: 'Lo-Fi Study Haven',
    tagline: 'Chill beats, vintage Rhodes & rain sounds for deep focus',
    genre: 'Lo-Fi / Chillhop',
    bitRate: '320 kbps AAC',
    listenersCount: 28450,
    color: '#10B981',
    accentColor: '#059669',
    currentTrack: TRACK_CATALOG[2]
  },
  {
    id: 'station-3',
    name: 'Aura Deep Ambient',
    tagline: 'Atmospheric space drift, generative drones & calm meditation',
    genre: 'Ambient',
    bitRate: '320 kbps Opus',
    listenersCount: 9120,
    color: '#8B5CF6',
    accentColor: '#6D28D9',
    currentTrack: TRACK_CATALOG[3]
  },
  {
    id: 'station-4',
    name: 'Underground Pulse FM',
    tagline: 'Modular techno, Berlin warehouse rhythms & driving bass',
    genre: 'Techno',
    bitRate: '320 kbps FLAC',
    listenersCount: 19830,
    color: '#F43F5E',
    accentColor: '#BE123C',
    currentTrack: TRACK_CATALOG[4]
  },
  {
    id: 'station-5',
    name: 'Tokyo Future Funk',
    tagline: 'Japanese City Pop, Nu-Disco grooves & anime nostalgia',
    genre: 'City Pop / Funk',
    bitRate: '320 kbps AAC',
    listenersCount: 16400,
    color: '#EC4899',
    accentColor: '#DB2777',
    currentTrack: TRACK_CATALOG[1]
  },
  {
    id: 'station-6',
    name: 'Tech Horizon Live Stream',
    tagline: 'Continuous round-the-clock developer discussions and podcast panels',
    genre: 'Tech Podcast',
    bitRate: '192 kbps AAC',
    listenersCount: 6780,
    color: '#F59E0B',
    accentColor: '#D97706',
    currentTrack: TRACK_CATALOG[5]
  }
];

