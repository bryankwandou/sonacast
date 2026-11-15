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
  sourceTag?: string;
  genre: string;
  lyrics: LyricLine[];
  artistSolanaAddress: string;
  bpm: number;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type EqPreset = 'flat' | 'bass' | 'vocal' | 'club' | 'acoustic';
export type MoodPreset =
  | 'all'
  | 'focus'
  | 'chill'
  | 'upbeat'
  | 'workout'
  | 'lateNight'
  | 'party'
  | 'romance'
  | 'sleep'
  | 'classic'
  | 'indonesian'
  | 'acoustic';

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  shareCode?: string;
  isPublic?: boolean;
  tracks: Track[];
  createdAt: number;
  updatedAt?: number;
}

export interface FavoriteTrack extends Track {
  note?: string;
  pinned?: boolean;
  favoritedAt?: number;
}

export interface FollowedArtist {
  name: string;
  genre: string;
  followedAt?: number;
}

export interface ListenerProfile {
  listenerId: string;
  displayName: string;
  handle: string;
  bio: string;
}

export interface ListeningStats {
  totalPlays: number;
  totalMinutes: number;
  favoritesCount: number;
  albumsCount: number;
  followedCount: number;
  topArtists: { name: string; score: number }[];
  topGenres: { name: string; score: number }[];
}

export interface BlendRoom {
  blendCode: string;
  creatorId: string;
  creatorName: string;
  partnerId?: string | null;
  partnerName?: string | null;
  title: string;
  matchScore: number;
  sharedArtists: string[];
  sharedGenres: string[];
  blendedTracks: Track[];
  creatorProfile?: {
    name?: string;
    artists?: string[];
    genres?: string[];
    avgBpm?: number;
  };
  partnerProfile?: {
    name?: string;
    artists?: string[];
    genres?: string[];
    avgBpm?: number;
  } | null;
  status: 'open' | 'matched';
  createdAt: number;
  updatedAt: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  mode: 'songs' | 'albums' | 'playlists';
  matchedTrack?: Track;
  searchedAt: number;
}

export interface CloudLibrarySnapshot {
  connected: boolean;
  database: string;
  profile: ListenerProfile;
  favorites: FavoriteTrack[];
  albums: UserPlaylist[];
  followedArtists: FollowedArtist[];
  recentHistory: (Track & { playedAt?: number })[];
  searchHistory?: SearchHistoryEntry[];
  stats: ListeningStats;
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
export type StageExperienceMode =
  | 'music-only'
  | 'orbwave-only'
  | 'video-only'
  | 'lyrics-only'
  | 'video-lyric'
  | 'music-lyric';
export type TabType =
  | 'landing'
  | 'discover'
  | 'vibe'
  | 'favorites'
  | 'blend'
  | 'search'
  | 'radio'
  | 'podcasts'
  | 'visualizer'
  | 'pitch'
  | 'proofOfStream';
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

export type SolanaCluster = 'devnet' | 'mainnet-beta';
export type WalletAdapterName = 'phantom' | 'solflare' | 'backpack' | 'browser' | 'devnet-local';
export type TipRouteType = 'direct_artist' | 'escrow_vault' | 'unconfigured';

export interface FeeBenchmarkItem {
  platform: string;
  creatorSharePct: number;
  platformFeePct: number;
}

export interface Web3ClusterConfig {
  ready: boolean;
  escrowReady?: boolean;
  treasuryAddress: string;
  escrowAddress: string;
  hasCustomRpc: boolean;
}

export interface Web3TipsConfig {
  connected: boolean;
  platformFeeBps: number;
  artistShareBps: number;
  minTipSol: number;
  feeBenchmarks: FeeBenchmarkItem[];
  clusters: Record<SolanaCluster, Web3ClusterConfig>;
}

export interface ArtistWalletStatus {
  artistKey: string;
  artistName: string;
  cluster: SolanaCluster;
  verified: boolean;
  verifiedWallet: string | null;
  verifiedAt: string | null;
  effectiveRecipient: string | null;
  treasuryAddress: string | null;
  escrowAddress: string | null;
  routeType: TipRouteType;
  stats: {
    tipCount: number;
    totalGrossSol: number;
    totalArtistSol: number;
    totalPlatformFeeSol: number;
    unclaimedEscrowSol: number;
  };
}

export interface TipRecord {
  id: string;
  recipient: string;
  recipientName: string;
  amountSol: number;
  artistShareSol: number;
  feeSol: number;
  platformFeeBps: number;
  treasuryAddress: string;
  routeType: TipRouteType;
  cluster: SolanaCluster;
  senderWallet?: string;
  verifiedOnChain: boolean;
  claimed?: boolean;
  claimedTx?: string | null;
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
  settlementStatus?: 'pending_batch' | 'settled';
  txSignature?: string;
  createdAt?: string;
}

export type PlaybackContextType =
  | 'album'
  | 'release-album'
  | 'recommendation'
  | 'playlist'
  | 'charts'
  | 'search'
  | 'blend'
  | 'radio'
  | 'library';

export interface PlaybackContextInfo {
  id: string;
  type: PlaybackContextType;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  ordered?: boolean;
}

export interface CatalogAlbum {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  nbTracks?: number;
  releaseDate?: string;
  recordType?: string;
  genre?: string;
  fallbackTracks?: Track[];
}

export interface CatalogPlaylist {
  id: string;
  title: string;
  creator: string;
  coverUrl: string;
  nbTracks?: number;
  description?: string;
}

export interface RecommendationMix {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tracks: Track[];
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  listenerId: string;
  authProvider: 'email' | 'google' | 'privy';
  privyDid?: string;
  embeddedSolanaWallet?: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface AuthProvidersMeta {
  email: boolean;
  google: {
    enabled: boolean;
    status: 'coming_soon' | 'active';
  };
  privy?: {
    enabled: boolean;
    appId: string | null;
    embeddedWalletChain: 'solana';
    loginMethods: ('email' | 'wallet')[];
  };
}



