export interface LyricLine {
  time: number; // in seconds
  text: string;
  translation?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  coverUrl: string;
  videoUrl?: string;
  audioUrl?: string; // fallback synthetic sound if offline
  genre: string;
  lyrics: LyricLine[];
  artistSolanaAddress: string;
  bpm: number;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  host: string;
  podcastName: string;
  duration: number;
  coverUrl: string;
  videoUrl?: string;
  description: string;
  episodeNumber: number;
  transcript: LyricLine[];
  hostSolanaAddress: string;
}

export interface RadioStation {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  bitRate: string;
  listenersCount: number;
  color: string;
  accentColor: string;
  currentTrack: Track;
}

export type PlayerMode = 'cover' | 'video' | 'orbwave';
export type TabType = 'discover' | 'radio' | 'podcasts' | 'visualizer' | 'pitch' | 'proofOfStream';
export type Language = 'en' | 'id' | 'ja' | 'es' | 'de';

export interface TipRecord {
  id: string;
  recipient: string;
  recipientName: string;
  amountSol: number;
  txSignature: string;
  timestamp: string;
  trackTitle: string;
}

export interface ProofOfStreamRecord {
  id: string;
  trackId: string;
  trackTitle: string;
  artist: string;
  secondsListened: number;
  earnedRewardSol: number;
  verifiedOnChain: boolean;
  txSignature?: string;
}

