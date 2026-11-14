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
  audioUrl?: string; // bundled studio master MP3 or local user upload blob URL
  youtubeId?: string; // primary official full-length YouTube stream ID
  candidateVideoIds?: string[]; // failover official embed-safe stream IDs
  streamSource?: 'studio-master' | 'official-stream' | 'local-upload' | 'synth';
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
export type TabType = 'landing' | 'discover' | 'search' | 'radio' | 'podcasts' | 'visualizer' | 'pitch' | 'proofOfStream';
export type ThemeMode = 'dark' | 'light';
export type Language =
  | 'en'
  | 'id'
  | 'ms'
  | 'jv'
  | 'su'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'zh-TW'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'nl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'th'
  | 'vi'
  | 'tl'
  | 'tr'
  | 'pl'
  | 'sv';

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

