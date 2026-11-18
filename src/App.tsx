import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  BlendRoom,
  CatalogAlbum,
  CatalogPlaylist,
  CloudLibrarySnapshot,
  Track,
  PodcastEpisode,
  RadioStation,
  StageExperienceMode,
  SearchHistoryEntry,
  TabType,
  LyricLine,
  MusicVideoCandidate,
  EqPreset,
  MoodPreset,
  RepeatMode,
  FavoriteTrack,
  FollowedArtist,
  ListenerProfile,
  ListeningStats,
  PlaybackContextInfo,
  UserPlaylist,
  AuthUser,
  AuthProvidersMeta
} from './types';
import { TRACK_CATALOG, PODCAST_CATALOG, RADIO_STATIONS } from './data/catalog';
import { COHESIVE_SEED_TRACKS } from './data/curatedPlaylists';
import { sharedAudioEngine } from './services/audioEngine';
import { solanaService } from './services/solanaService';
import {
  fetchAlbumTracksOnline,
  fetchLyricsWithMeta,
  findMasterAudio,
  peekCachedTrackStream,
  resolveFullTrackStream,
  resolveMusicVideoStream,
  searchAlbumsOnline,
  searchLiveRadioStations,
  searchPlaylistsOnline,
  searchPodcastsOnline,
  searchTracksOnline
} from './services/musicService';
import {
  loadLocalSearchHistory,
  mergeSearchHistory,
  saveLocalSearchHistory,
  upsertSearchHistory
} from './services/searchHistoryService';
import {
  buildSmartQueueFromPool,
  classifyTrackTier,
  getClassMatchedSeedQueries,
  getMoodSearchQuery,
  getMoodSeedQueries,
  inferTrackLanguageRegion,
  loadRecommendationState,
  pickNextTrackPure,
  recordTrackSignal,
  saveRecommendationState,
  type RecommendationState
} from './services/recommendationEngine';
import {
  cloneSharedAlbumToNeon,
  fetchListenerBlends,
  fetchNeonLibrary,
  getOrCreateListenerIdentity,
  mutateNeonLibrary,
  rotateGuestListenerIdentity,
  saveListenerDisplayName,
  setAuthenticatedListenerIdentity
} from './services/neonSyncService';
import { fetchAuthSession, logoutFromNeon } from './services/authService';
import { useAppPreferences } from './contexts/AppPreferencesContext';
import { usePopularCharts } from './hooks/usePopularCharts';
import { MoodStrip } from './components/common/MoodStrip';

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';
import { ExpandedPlayerModal } from './components/player/ExpandedPlayerModal';
import {
  FloatingMiniPlayer,
  openDesktopPipWindow,
  type DesktopPipController
} from './components/player/FloatingMiniPlayer';

import { VinylCover } from './components/player/VinylCover';
import { VideoPlayer } from './components/player/VideoPlayer';
import { OrbwaveCanvas } from './components/visualizer/OrbwaveCanvas';
import { LiveLyrics } from './components/lyrics/LiveLyrics';

import { ToastBanner } from './components/common/ToastBanner';
import {
  isCacheableAudioUrl,
  isTrackSavedOffline,
  listOfflineAudioUrls,
  removeTrackOffline,
  saveTrackOffline
} from './services/offlineCacheService';
import { LandingView } from './components/views/LandingView';
import { DiscoverView } from './components/views/DiscoverView';
import { VibeFeedView } from './components/views/VibeFeedView';
import { FavoritesView } from './components/views/FavoritesView';
import { BlendView } from './components/views/BlendView';
import { MusicView } from './components/views/MusicView';
import { SearchView } from './components/views/SearchView';
import { RadioView } from './components/views/RadioView';
import { PodcastsView } from './components/views/PodcastsView';
import { VisualizerStudioView } from './components/views/VisualizerStudioView';
import { ProofOfStreamView } from './components/rewards/ProofOfStreamView';

import { AddToAlbumModal } from './components/modals/AddToAlbumModal';
import { ArtistSpotlightModal } from './components/modals/ArtistSpotlightModal';
import { AuthModal } from './components/auth/AuthModal';
import { LyricCardModal } from './components/modals/LyricCardModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SolanaWalletModal } from './components/web3/SolanaWalletModal';
import { PitchDeckModal } from './components/pitch/PitchDeckModal';
import { getPrimaryArtistName } from './utils/coverColor';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from './utils/coverFallback';
import { parseTabFromUrl, syncUrlForTab } from './utils/routes';
import {
  Activity,
  Clock,
  Disc,
  Disc3,
  Heart,
  Home,
  ListMusic,
  Loader2,
  Menu,
  Mic2,
  Music,
  Play,
  Radio,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  Users,
  Video,
  WifiOff,
  X
} from 'lucide-react';

export default function App() {
  const { t } = useAppPreferences();
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      return parseTabFromUrl(window.location.pathname, window.location.search);
    }
    return 'landing';
  });
  const isInitialRouteMountRef = useRef(true);
  const skipNextHistoryPushRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInitialRouteMountRef.current) {
      isInitialRouteMountRef.current = false;
      syncUrlForTab(currentTab, 'replace');
      return;
    }
    if (skipNextHistoryPushRef.current) {
      skipNextHistoryPushRef.current = false;
      syncUrlForTab(currentTab, 'replace');
      return;
    }
    syncUrlForTab(currentTab, 'push');
  }, [currentTab]);

  const [currentTrack, setCurrentTrack] = useState<Track>(() => {
    if (typeof window !== 'undefined') {
      const trackParam = new URLSearchParams(window.location.search).get('track')?.trim();
      if (trackParam) {
        const match = TRACK_CATALOG.find(
          (item) => item.id === trackParam || item.title.toLowerCase() === trackParam.toLowerCase()
        );
        if (match) return match;
      }
    }
    return TRACK_CATALOG[0];
  });
  const [queue, setQueue] = useState<Track[]>(TRACK_CATALOG);
  const [stageMode, setStageMode] = useState<StageExperienceMode>('orbwave-only');
  const [isStageOpen, setIsStageOpen] = useState(() => currentTab === 'visualizer');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const parsed = parseTabFromUrl(window.location.pathname, window.location.search);
      skipNextHistoryPushRef.current = true;
      setCurrentTab(parsed);
      setIsStageOpen(parsed === 'visualizer');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');
  const [lyricsSynced, setLyricsSynced] = useState<boolean>(false);
  const [lyricOffsetsByTrack, setLyricOffsetsByTrack] = useState<Record<string, number>>(() => {
    try {
      const raw = window.localStorage.getItem('sonacast_lyric_offsets_v1');
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });
  const resolvedLyricsMetaRef = useRef<{ trackId: string; fetchDur: number }>({
    trackId: currentTrack.id,
    fetchDur: currentTrack.duration
  });

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authProviders, setAuthProviders] = useState<AuthProvidersMeta | undefined>(undefined);
  const [walletBalanceSol, setWalletBalanceSol] = useState(0);
  const [walletCluster, setWalletCluster] = useState<'devnet' | 'mainnet-beta'>(() =>
    solanaService.getCluster()
  );

  // Top persistent search bar, search history & SearchView handoff
  const [topSearchInput, setTopSearchInput] = useState('');
  const [isTopSearchFocused, setIsTopSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() =>
    loadLocalSearchHistory()
  );
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalSearchMode, setExternalSearchMode] = useState<'songs' | 'albums' | 'playlists'>('songs');
  const [externalSelectedAlbum, setExternalSelectedAlbum] = useState<CatalogAlbum | null>(null);
  const [externalSelectedPlaylist, setExternalSelectedPlaylist] = useState<CatalogPlaylist | null>(null);
  const [externalSearchTrigger, setExternalSearchTrigger] = useState(0);
  const { popularCharts } = usePopularCharts();
  const [topInstantResults, setTopInstantResults] = useState<{
    query: string;
    tracks: Track[];
    albums: CatalogAlbum[];
    playlists: CatalogPlaylist[];
  }>({ query: '', tracks: [], albums: [], playlists: [] });
  const [isLoadingTopInstant, setIsLoadingTopInstant] = useState(false);

  useEffect(() => {
    const trimmed = topSearchInput.trim();
    if (!isTopSearchFocused || trimmed.length < 2) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoadingTopInstant(true);
      try {
        const [tracksRes, albumsRes, playlistsRes] = await Promise.all([
          searchTracksOnline(trimmed).catch(() => [] as Track[]),
          searchAlbumsOnline(trimmed).catch(() => [] as CatalogAlbum[]),
          searchPlaylistsOnline(trimmed).catch(() => [] as CatalogPlaylist[])
        ]);
        if (!cancelled) {
          setTopInstantResults({
            query: trimmed,
            tracks: tracksRes.slice(0, 4),
            albums: albumsRes.slice(0, 3),
            playlists: playlistsRes.slice(0, 3)
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTopInstant(false);
        }
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isTopSearchFocused, topSearchInput]);

  // 24/7 Low-CPU / Battery Saver, Floating Mini Icon & Desktop PiP
  const [lowCpuMode, setLowCpuMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sonacast_low_cpu_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isFloatingMinimized, setIsFloatingMinimized] = useState(false);
  const pipControllerRef = useRef<DesktopPipController | null>(null);
  const searchHistoryRef = useRef<SearchHistoryEntry[]>(searchHistory);
  useEffect(() => {
    searchHistoryRef.current = searchHistory;
  }, [searchHistory]);

  const [recState, setRecState] = useState<RecommendationState>(() => loadRecommendationState());
  const [manualQueue, setManualQueue] = useState<Track[]>([]);
  const [playHistory, setPlayHistory] = useState<Track[]>([]);
  const [activeMood, setActiveMood] = useState<MoodPreset>('all');
  const [playbackContext, setPlaybackContext] = useState<PlaybackContextInfo>({
    id: 'featured-catalog',
    type: 'library',
    title: 'Featured Masters',
    ordered: true
  });
  const [autoplayEnabled, setAutoplayEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sonacast_autoplay_enabled');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [sleepEndAtMs, setSleepEndAtMs] = useState<number | null>(null);
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(null);

  const likedTrackIds = useMemo(
    () => new Set(recState.likedTracks.map((tr) => tr.id)),
    [recState.likedTracks]
  );

  // Neon Postgres cloud sync & social library state
  const initialIdentity = useMemo(() => getOrCreateListenerIdentity(), []);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [listenerProfile, setListenerProfile] = useState<ListenerProfile>(() => ({
    listenerId: initialIdentity.listenerId,
    displayName: initialIdentity.displayName,
    handle: `@${initialIdentity.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'listener'}`,
    bio: ''
  }));
  const [favoritesMeta, setFavoritesMeta] = useState<FavoriteTrack[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [cloudStats, setCloudStats] = useState<ListeningStats | null>(null);
  const [blends, setBlends] = useState<BlendRoom[]>([]);
  const [albumModalTrack, setAlbumModalTrack] = useState<Track | null>(null);
  const [artistSpotlightName, setArtistSpotlightName] = useState<string | null>(null);
  const [walletTargetArtist, setWalletTargetArtist] = useState<{
    artist: string;
    trackTitle?: string;
  } | null>(null);
  const [activeRadioStationId, setActiveRadioStationId] = useState<string | null>(null);
  const [lyricCardState, setLyricCardState] = useState<{ open: boolean; lineIndex: number | null }>({
    open: false,
    lineIndex: null
  });
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialBlendCode, setInitialBlendCode] = useState<string | null>(null);
  const [normalizationEnabled, setNormalizationEnabled] = useState(true);
  const [vocalReductionEnabled, setVocalReductionEnabled] = useState(false);
  const [offlineAudioKeys, setOfflineAudioKeys] = useState<Set<string>>(() => new Set());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [toastState, setToastState] = useState<{
    message: string;
    tone: 'default' | 'success' | 'warning';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const topSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0 });
  }, [currentTab]);

  const showToast = useCallback(
    (message: string, tone: 'default' | 'success' | 'warning' = 'default') => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToastState({ message, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setToastState(null);
        toastTimerRef.current = null;
      }, 2600);
    },
    []
  );

  const favoritesList = useMemo<FavoriteTrack[]>(() => {
    const metaById = new Map(favoritesMeta.map((f) => [f.id, f]));
    const merged = recState.likedTracks.map((tr) => {
      const meta = metaById.get(tr.id);
      return {
        ...tr,
        note: meta?.note || '',
        pinned: Boolean(meta?.pinned),
        favoritedAt: meta?.favoritedAt
      };
    });
    return merged.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [recState.likedTracks, favoritesMeta]);

  const effectiveStats = useMemo<ListeningStats>(() => {
    if (cloudStats) return cloudStats;
    const totalMinutes = Math.round(
      recState.recentTracks.reduce((sum, item) => sum + (item.duration || 0), 0) / 60
    );
    const topArtists = Object.entries(recState.artistAffinity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, score]) => ({ name, score: Math.round(score) }));
    const topGenres = Object.entries(recState.genreAffinity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, score]) => ({ name, score: Math.round(score) }));
    return {
      totalPlays: recState.recentTracks.length,
      totalMinutes,
      favoritesCount: recState.likedTracks.length,
      albumsCount: recState.playlists.length,
      followedCount: followedArtists.length,
      topArtists,
      topGenres
    };
  }, [
    cloudStats,
    recState.recentTracks,
    recState.artistAffinity,
    recState.genreAffinity,
    recState.likedTracks.length,
    recState.playlists.length,
    followedArtists.length
  ]);

  // Stream resolution & official backend state
  const [isYouTubeActive, setIsYouTubeActive] = useState(false);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const [resolvingVideoTrackId, setResolvingVideoTrackId] = useState<string | null>(null);
  const [activeYtVideoId, setActiveYtVideoId] = useState<string>(() =>
    sharedAudioEngine.getCurrentYouTubeVideoId()
  );
  const [isYtVisualReady, setIsYtVisualReady] = useState<boolean>(() =>
    sharedAudioEngine.getYouTubeVisualReady()
  );
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleNextRef = useRef<(fromEnded?: boolean) => void>(() => { });
  const handleTogglePlayRef = useRef<() => void>(() => { });
  const selectionCounterRef = useRef(0);
  const mvResolveAbortRef = useRef<AbortController | null>(null);
  const mvSelectionTokenRef = useRef(0);
  const stageModeRef = useRef(stageMode);
  const isStageVisibleRef = useRef(false);
  useEffect(() => {
    stageModeRef.current = stageMode;
    isStageVisibleRef.current = isStageOpen || currentTab === 'visualizer';
  }, [stageMode, isStageOpen, currentTab]);
  const resolvingTrackIdRef = useRef<string | null>(null);
  const resolvingStartedAtRef = useRef(0);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const loadedTrackIdRef = useRef<string | null>(null);
  const isRefillingRadioRef = useRef(false);
  const preResolvedIdsRef = useRef<Set<string>>(new Set());
  const discoveredPoolRef = useRef<Map<string, Track>>(new Map());
  const autoRetryCountRef = useRef(0);
  const lastErrAutoSkipAtRef = useRef(0);

  const currentTrackRef = useRef(currentTrack);
  const currentTimeRef = useRef(currentTime);
  const queueRef = useRef(queue);
  const manualQueueRef = useRef(manualQueue);
  const recStateRef = useRef(recState);
  const activeMoodRef = useRef(activeMood);
  const playHistoryRef = useRef(playHistory);
  const playbackContextRef = useRef(playbackContext);
  const autoplayEnabledRef = useRef(autoplayEnabled);
  const refillRadioRef = useRef<(seedTrack: Track, force?: boolean) => void>(() => { });

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    currentTimeRef.current = currentTime;
    queueRef.current = queue;
    manualQueueRef.current = manualQueue;
    recStateRef.current = recState;
    activeMoodRef.current = activeMood;
    playHistoryRef.current = playHistory;
    playbackContextRef.current = playbackContext;
    autoplayEnabledRef.current = autoplayEnabled;
  }, [
    currentTrack,
    currentTime,
    queue,
    manualQueue,
    recState,
    activeMood,
    playHistory,
    playbackContext,
    autoplayEnabled
  ]);

  // Apply persisted Audio DSP (Equalizer, Speed, Crossfade)
  useEffect(() => {
    sharedAudioEngine.setEqPreset(recState.eqPreset);
    sharedAudioEngine.setPlaybackRate(recState.playbackRate);
    sharedAudioEngine.setCrossfadeSeconds(recState.crossfadeSeconds);
  }, [recState.eqPreset, recState.playbackRate, recState.crossfadeSeconds]);

  // Sleep timer countdown & automatic pause
  useEffect(() => {
    if (!sleepEndAtMs) return;
    const tick = () => {
      const remMs = sleepEndAtMs - Date.now();
      if (remMs <= 0) {
        sharedAudioEngine.pause();
        setSleepEndAtMs(null);
        setSleepMinutesRemaining(null);
      } else {
        setSleepMinutesRemaining(Math.max(1, Math.ceil(remMs / 60000)));
      }
    };
    const initTimer = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 15000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
    };
  }, [sleepEndAtMs]);

  const pendingCloudMutationsRef = useRef(0);

  const applyCloudSnapshot = useCallback((snapshot: CloudLibrarySnapshot | null) => {
    if (!snapshot || !snapshot.connected) return;
    setCloudConnected(true);
    setListenerProfile(snapshot.profile);
    if (snapshot.profile.displayName) {
      saveListenerDisplayName(snapshot.profile.displayName);
    }
    setFavoritesMeta(snapshot.favorites);
    setFollowedArtists(snapshot.followedArtists);
    setCloudStats(snapshot.stats);

    if (Array.isArray(snapshot.searchHistory)) {
      const mergedHistory = mergeSearchHistory(searchHistoryRef.current, snapshot.searchHistory);
      searchHistoryRef.current = mergedHistory;
      saveLocalSearchHistory(mergedHistory);
      setSearchHistory(mergedHistory);
    }

    setRecState((prev) => {
      const recentMap = new Map<string, Track>();
      for (const tr of [...snapshot.recentHistory, ...prev.recentTracks]) {
        if (tr?.id && !recentMap.has(tr.id)) {
          recentMap.set(tr.id, tr);
        }
      }
      const next: RecommendationState = {
        ...prev,
        likedTracks: snapshot.favorites,
        playlists: snapshot.albums,
        recentTracks: Array.from(recentMap.values()).slice(0, 40)
      };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const runCloudMutation = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      pendingCloudMutationsRef.current += 1;
      try {
        const snap = await mutateNeonLibrary(action, payload);
        pendingCloudMutationsRef.current = Math.max(0, pendingCloudMutationsRef.current - 1);
        if (snap && snap.connected) {
          if (pendingCloudMutationsRef.current === 0) {
            applyCloudSnapshot(snap);
          } else {
            setCloudConnected(true);
            setCloudStats(snap.stats);
          }
        }
        return snap;
      } catch {
        pendingCloudMutationsRef.current = Math.max(0, pendingCloudMutationsRef.current - 1);
        return null;
      }
    },
    [applyCloudSnapshot]
  );

  const hydrateListenerData = useCallback(
    async (targetListenerId: string, syncLocalIfNeeded: boolean) => {
      const snapshot = await fetchNeonLibrary(targetListenerId);
      if (snapshot && snapshot.connected) {
        if (syncLocalIfNeeded) {
          const local = recStateRef.current;
          const missingFavs = local.likedTracks.some(
            (lf) => !snapshot.favorites.some((cf) => cf.id === lf.id)
          );
          const missingAlbums = local.playlists.some(
            (lp) => !snapshot.albums.some((ca) => ca.id === lp.id)
          );
          if (missingFavs || missingAlbums) {
            const merged = await mutateNeonLibrary('sync_local_state', {
              favorites: local.likedTracks,
              albums: local.playlists
            });
            applyCloudSnapshot(merged || snapshot);
          } else {
            applyCloudSnapshot(snapshot);
          }
        } else {
          applyCloudSnapshot(snapshot);
        }
      }
      const listenerBlends = await fetchListenerBlends(targetListenerId);
      setBlends(listenerBlends);
      return snapshot;
    },
    [applyCloudSnapshot]
  );

  const handleAuthSuccess = useCallback(
    async (user: AuthUser) => {
      const sameListener = user.listenerId === getOrCreateListenerIdentity().listenerId;
      setAuthenticatedListenerIdentity(user.listenerId, user.displayName);
      setAuthUser(user);
      setListenerProfile((prev) => ({
        ...prev,
        listenerId: user.listenerId,
        displayName: user.displayName
      }));
      await hydrateListenerData(user.listenerId, sameListener);
    },
    [hydrateListenerData]
  );

  const handleLogout = useCallback(async () => {
    await logoutFromNeon();
    const guest = rotateGuestListenerIdentity();
    setAuthUser(null);
    setFavoritesMeta([]);
    setFollowedArtists([]);
    setCloudStats(null);
    setBlends([]);
    setListenerProfile({
      listenerId: guest.listenerId,
      displayName: guest.displayName,
      handle: '@listener',
      bio: ''
    });
    setRecState((prev) => {
      const next: RecommendationState = {
        ...prev,
        likedTracks: [],
        playlists: [],
        recentTracks: []
      };
      saveRecommendationState(next);
      return next;
    });
    await hydrateListenerData(guest.listenerId, false);
  }, [hydrateListenerData]);

  // Hydrate Neon Auth session, Postgres library, blends, and share deep-links (?blend= / ?album=)
  useEffect(() => {
    let cancelled = false;
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const blendParam = params?.get('blend')?.trim().toUpperCase() || '';
    const albumParam = params?.get('album')?.trim().toUpperCase() || '';

    const hydrateCloud = async () => {
      const authSession = await fetchAuthSession();
      if (cancelled) return;
      setAuthProviders(authSession.providers);

      let activeListenerId = initialIdentity.listenerId;
      if (authSession.authenticated && authSession.user) {
        activeListenerId = authSession.user.listenerId;
        setAuthenticatedListenerIdentity(
          authSession.user.listenerId,
          authSession.user.displayName
        );
        setAuthUser(authSession.user);
      }

      const snapshot = await hydrateListenerData(activeListenerId, true);
      if (cancelled) return;

      if (snapshot && snapshot.connected && albumParam) {
        const cloned = await cloneSharedAlbumToNeon(albumParam);
        if (!cancelled && cloned) {
          applyCloudSnapshot(cloned);
          setCurrentTab('favorites');
        }
      }

      if (!cancelled && blendParam) {
        setInitialBlendCode(blendParam);
        setCurrentTab('blend');
      }

      const trackParam = params?.get('track')?.trim() || '';
      if (!cancelled && trackParam) {
        const localMatch = TRACK_CATALOG.find(
          (item) => item.id === trackParam || item.title.toLowerCase() === trackParam.toLowerCase()
        );
        if (!localMatch) {
          const remoteMatches = await searchTracksOnline(trackParam).catch(() => []);
          if (!cancelled && remoteMatches[0]) {
            setCurrentTrack(remoteMatches[0]);
            setQueue((prev) => [
              remoteMatches[0],
              ...prev.filter((item) => item.id !== remoteMatches[0].id)
            ]);
          }
        }
      }
    };

    hydrateCloud();

    const refreshOfflineKeys = () => {
      void listOfflineAudioUrls().then((keys) => {
        if (!cancelled) setOfflineAudioKeys(keys);
      });
    };
    const handleOnlineChange = () => setIsOnline(navigator.onLine);
    refreshOfflineKeys();
    window.addEventListener('sonacast-offline-changed', refreshOfflineKeys);
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    return () => {
      cancelled = true;
      window.removeEventListener('sonacast-offline-changed', refreshOfflineKeys);
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, [initialIdentity.listenerId, applyCloudSnapshot, hydrateListenerData]);

  // Persistent YouTube host and layout target slots
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const videoSlotRef = useRef<HTMLDivElement | null>(null);
  const ytMonitorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sharedAudioEngine.mountYouTubeHost(ytHostRef.current);
    sharedAudioEngine.preloadYouTubeApi();
  }, []);

  useEffect(() => {
    const unsubTime = sharedAudioEngine.subscribeTimeUpdate((t) => setCurrentTime(t));
    const unsubVid = sharedAudioEngine.subscribeVideoIdChange((vid) => setActiveYtVideoId(vid));
    const unsubYtVis = sharedAudioEngine.subscribeYouTubeVisualReady((ready) =>
      setIsYtVisualReady(ready)
    );
    const unsubState = sharedAudioEngine.subscribeStateChange((p) => {
      setIsPlaying(p);
      if (p) {
        autoRetryCountRef.current = 0;
      }
    });
    const unsubEnd = sharedAudioEngine.subscribeTrackEnded(() => {
      handleNextRef.current(true);
    });
    const unsubDur = sharedAudioEngine.subscribeDurationChange((realDur) => {
      setCurrentTrack((prev) => ({ ...prev, duration: realDur }));
      const active = currentTrackRef.current;
      if (
        realDur >= 45 &&
        resolvedLyricsMetaRef.current.trackId === active.id &&
        Math.abs(realDur - resolvedLyricsMetaRef.current.fetchDur) >= 5
      ) {
        resolvedLyricsMetaRef.current.fetchDur = realDur;
        void fetchLyricsWithMeta(active.title, active.artist, realDur, active.album).then((res) => {
          if (currentTrackRef.current.id !== active.id || res.lyrics.length === 0) return;
          if (res.synced || currentTrackRef.current.lyrics.length < 18) {
            setLyricsSynced(res.synced);
            setLyricsStatus('loaded');
            setCurrentTrack((prev) => (prev.id === active.id ? { ...prev, lyrics: res.lyrics } : prev));
            setQueue((prevQ) =>
              prevQ.map((item) => (item.id === active.id ? { ...item, lyrics: res.lyrics } : item))
            );
          }
        });
      }
    });
    const unsubErr = sharedAudioEngine.subscribeError((msg) => {
      setStreamError(msg);
      const now = performance.now();
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      const isLiveRadio = currentTrackRef.current.sourceTag === 'live-radio';
      const canAdvance =
        !isLiveRadio &&
        recStateRef.current.repeatMode !== 'one' &&
        (autoplayEnabledRef.current ||
          queueRef.current.length > 1 ||
          manualQueueRef.current.length > 0);
      if (
        online &&
        canAdvance &&
        autoRetryCountRef.current < 4 &&
        now - lastErrAutoSkipAtRef.current > 1800
      ) {
        lastErrAutoSkipAtRef.current = now;
        autoRetryCountRef.current += 1;
        window.setTimeout(() => handleNextRef.current(true), 420);
      }
    });

    const handleWakeSync = () => {
      if (document.visibilityState === 'hidden') return;
      if (resolvingTrackIdRef.current && Date.now() - resolvingStartedAtRef.current > 8500) {
        resolveAbortRef.current?.abort();
        resolveAbortRef.current = null;
        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);
      }
      setIsPlaying(sharedAudioEngine.getIsPlaying());
    };

    document.addEventListener('visibilitychange', handleWakeSync);
    document.addEventListener('resume', handleWakeSync);
    window.addEventListener('pageshow', handleWakeSync);
    window.addEventListener('focus', handleWakeSync);
    window.addEventListener('online', handleWakeSync);

    return () => {
      unsubTime();
      unsubState();
      unsubEnd();
      unsubDur();
      unsubErr();
      unsubVid();
      unsubYtVis();
      document.removeEventListener('visibilitychange', handleWakeSync);
      document.removeEventListener('resume', handleWakeSync);
      window.removeEventListener('pageshow', handleWakeSync);
      window.removeEventListener('focus', handleWakeSync);
      window.removeEventListener('online', handleWakeSync);
    };
  }, []);

  const isStageVisible = isStageOpen || currentTab === 'visualizer';

  // Synchronize fixed overlay #sonacast-yt-host bounds with active slot (Video stage or RightSidebar monitor)
  useEffect(() => {
    const syncPosition = () => {
      const host = ytHostRef.current;
      if (!host) return;

      if (document.fullscreenElement === host) {
        host.style.position = 'fixed';
        host.style.left = '0px';
        host.style.top = '0px';
        host.style.width = '100vw';
        host.style.height = '100vh';
        host.style.opacity = '1';
        host.style.pointerEvents = 'auto';
        host.style.borderRadius = '0px';
        host.style.clipPath = 'none';
        host.style.zIndex = '9999';
        return;
      }

      if (!isYouTubeActive) {
        host.style.left = '-9999px';
        host.style.top = '-9999px';
        host.style.width = '320px';
        host.style.height = '180px';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        host.style.clipPath = 'none';
        return;
      }

      const isVideoStage = stageMode === 'video-only' || stageMode === 'video-lyric';
      const target = isStageVisible && isVideoStage ? videoSlotRef.current : ytMonitorRef.current;
      if (!target) {
        host.style.left = 'auto';
        host.style.top = 'auto';
        host.style.right = '12px';
        host.style.bottom = '92px';
        host.style.width = '160px';
        host.style.height = '90px';
        host.style.opacity = '0.005';
        host.style.pointerEvents = 'none';
        host.style.clipPath = 'none';
        host.style.zIndex = '1';
        return;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width >= 150 && rect.height >= 135) {
        if (isStageVisible && isVideoStage && mainScrollRef.current) {
          const mainRect = mainScrollRef.current.getBoundingClientRect();
          if (rect.bottom <= mainRect.top + 8 || rect.top >= mainRect.bottom - 8) {
            host.style.left = 'auto';
            host.style.top = 'auto';
            host.style.right = '12px';
            host.style.bottom = '92px';
            host.style.width = '160px';
            host.style.height = '90px';
            host.style.opacity = '0.005';
            host.style.pointerEvents = 'none';
            host.style.clipPath = 'none';
            host.style.zIndex = '1';
            return;
          }
          const clipTop = Math.max(0, mainRect.top - rect.top);
          const clipBottom = Math.max(0, rect.bottom - mainRect.bottom);
          host.style.clipPath =
            clipTop > 0 || clipBottom > 0
              ? `inset(${clipTop}px 0px ${clipBottom}px 0px round 1rem)`
              : 'none';
        } else {
          host.style.clipPath = 'none';
        }
        host.style.right = 'auto';
        host.style.bottom = 'auto';
        host.style.left = `${rect.left}px`;
        host.style.top = `${rect.top}px`;
        host.style.width = `${rect.width}px`;
        host.style.height = `${rect.height}px`;
        const visualAllowed = !streamError && (isYtVisualReady || (isStageVisible && isVideoStage));
        host.style.opacity = visualAllowed ? '1' : '0.005';
        host.style.pointerEvents = visualAllowed ? 'auto' : 'none';
        host.style.zIndex = visualAllowed ? '25' : '1';
        host.style.borderRadius = isVideoStage ? '1rem' : '0.75rem';
      } else {
        host.style.left = 'auto';
        host.style.top = 'auto';
        host.style.right = '12px';
        host.style.bottom = '92px';
        host.style.width = '160px';
        host.style.height = '90px';
        host.style.opacity = '0.005';
        host.style.pointerEvents = 'none';
        host.style.clipPath = 'none';
        host.style.zIndex = '1';
      }
    };

    syncPosition();
    const rafId = window.requestAnimationFrame(syncPosition);
    const snapTimer = window.setTimeout(syncPosition, 120);

    const ro = new ResizeObserver(syncPosition);
    if (videoSlotRef.current) ro.observe(videoSlotRef.current);
    if (ytMonitorRef.current) ro.observe(ytMonitorRef.current);

    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    document.addEventListener('fullscreenchange', syncPosition);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(snapTimer);
      ro.disconnect();
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
      document.removeEventListener('fullscreenchange', syncPosition);
    };
  }, [isYouTubeActive, isYtVisualReady, streamError, stageMode, currentTab, isStageVisible, resolvingVideoTrackId]);

  // Periodically check active Solana cluster balance & sync wallet switches (throttled when idle/hidden)
  useEffect(() => {
    const checkBal = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setWalletCluster(solanaService.getCluster());
      const bal = await solanaService.fetchBalance();
      setWalletBalanceSol(bal);
    };
    checkBal();
    const unsub = solanaService.subscribe(() => {
      setWalletCluster(solanaService.getCluster());
      setWalletBalanceSol(solanaService.getCachedBalance());
    });
    const interval = setInterval(() => {
      if (!lowCpuMode) {
        checkBal();
      }
    }, 60000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [lowCpuMode]);

  const buildAutoSimilarContext = useCallback((track: Track): PlaybackContextInfo => {
    const tier = classifyTrackTier(track);
    return {
      id: `auto-${track.id}`,
      type: 'radio',
      title: `Auto-Next · ${tier.classLabel}`,
      subtitle: `Similar to ${track.title} · ${track.artist}`,
      coverUrl: track.coverUrl,
      ordered: false
    };
  }, []);

  const gatherLocalCandidatePool = useCallback((excludeTrackId?: string): Track[] => {
    const merged = new Map<string, Track>();
    for (const src of [
      ...Array.from(discoveredPoolRef.current.values()),
      ...recStateRef.current.likedTracks,
      ...recStateRef.current.recentTracks,
      ...queueRef.current,
      ...COHESIVE_SEED_TRACKS,
      ...TRACK_CATALOG
    ]) {
      if (src && src.id && src.id !== excludeTrackId && !merged.has(src.id)) {
        merged.set(src.id, src);
      }
    }
    return Array.from(merged.values());
  }, []);

  const refillRadioQueueIfNeeded = useCallback(async (seedTrack: Track, force = false) => {
    if (isRefillingRadioRef.current) return;
    const currentQ = queueRef.current;
    const idx = currentQ.findIndex((item) => item.id === seedTrack.id);
    const remaining = idx >= 0 ? currentQ.length - 1 - idx : 0;
    if (!force && remaining > 3) return;

    isRefillingRadioRef.current = true;
    try {
      const queries = getClassMatchedSeedQueries(seedTrack, activeMoodRef.current, 4);
      const batches = await Promise.allSettled(queries.map((q) => searchTracksOnline(q)));
      const pooled: Track[] = [];
      for (const b of batches) {
        if (b.status === 'fulfilled' && Array.isArray(b.value)) {
          for (const tr of b.value) {
            if (tr && tr.id) {
              discoveredPoolRef.current.set(tr.id, tr);
              pooled.push(tr);
            }
          }
        }
      }
      const localSeedPool = gatherLocalCandidatePool(seedTrack.id);
      const combinedPool = [...pooled, ...localSeedPool];
      if (combinedPool.length === 0) return;

      const seedTier = classifyTrackTier(seedTrack);
      const seedLang = inferTrackLanguageRegion(seedTrack);
      const sameLangAndClass = combinedPool.filter((c) => {
        const ct = classifyTrackTier(c);
        const cl = inferTrackLanguageRegion(c);
        const classMatch = ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
        if (!classMatch) return false;
        if (seedLang !== 'en' && seedLang !== 'instrumental') {
          return cl === seedLang;
        }
        return true;
      });
      const sameOrCompatible =
        sameLangAndClass.length >= 6
          ? sameLangAndClass
          : combinedPool.filter((c) => {
              const ct = classifyTrackTier(c);
              return (
                ct.classId === seedTier.classId ||
                seedTier.compatibleClasses.includes(ct.classId)
              );
            });
      const candidatePool = sameOrCompatible.length >= 6 ? sameOrCompatible : combinedPool;

      setQueue((prev) => {
        const activeId = currentTrackRef.current.id;
        const activeIdx = prev.findIndex((p) => p.id === activeId);
        // Only trim old tail when fresh cohesive replacement pool is substantial (>= 8 tracks), preventing 2-track queue truncation
        const preservedHead =
          force && activeIdx >= 0 ? prev.slice(0, activeIdx + 1) : prev;
        const headIds = new Set(preservedHead.map((p) => p.id));
        const freshCandidates = candidatePool.filter((c) => c && c.id && !headIds.has(c.id));
        const rankedFresh = buildSmartQueueFromPool(
          seedTrack,
          freshCandidates,
          recStateRef.current.recentTracks,
          recStateRef.current,
          activeMoodRef.current,
          20
        );
        if (rankedFresh.length < 8 && force && activeIdx >= 0 && prev.length > activeIdx + 1) {
          const fallbackTail = prev.slice(activeIdx + 1).filter(
            (t) => t && t.id && !rankedFresh.some((r) => r.id === t.id) && !headIds.has(t.id)
          );
          const merged = [...preservedHead, ...rankedFresh, ...fallbackTail].slice(-50);
          queueRef.current = merged;
          return merged;
        }
        if (rankedFresh.length === 0) return prev;
        const merged = [...preservedHead, ...rankedFresh].slice(-50);
        queueRef.current = merged;
        return merged;
      });
    } catch {
      // Quiet background radio refill
    } finally {
      isRefillingRadioRef.current = false;
    }
  }, [gatherLocalCandidatePool]);

  const handleUpdateTrackLyrics = (lyrics: LyricLine[], targetTrackId?: string) => {
    setCurrentTrack((prev) => {
      if (targetTrackId && prev.id !== targetTrackId) return prev;
      return { ...prev, lyrics };
    });
    if (targetTrackId) {
      setQueue((prevQ) => prevQ.map((t) => (t.id === targetTrackId ? { ...t, lyrics } : t)));
    }
    if (lyrics.length > 0) {
      setLyricsStatus('loaded');
    }
  };

  const resolveLyricsForTrack = useCallback(
    async (
      targetTrack: Track,
      opts?: {
        customTitle?: string;
        customArtist?: string;
        forceRefresh?: boolean;
        backgroundUpgrade?: boolean;
        overrideDuration?: number;
      }
    ) => {
      const targetDur = opts?.overrideDuration || targetTrack.duration;
      resolvedLyricsMetaRef.current = { trackId: targetTrack.id, fetchDur: targetDur };
      if (!opts?.backgroundUpgrade) {
        setLyricsStatus('loading');
      }
      try {
        const res = await fetchLyricsWithMeta(
          opts?.customTitle || targetTrack.title,
          opts?.customArtist || targetTrack.artist,
          targetDur,
          targetTrack.album,
          opts?.forceRefresh
        );
        if (currentTrackRef.current.id !== targetTrack.id) return;
        if (res.lyrics.length > 0) {
          const existingLen = currentTrackRef.current.lyrics.length;
          if (opts?.backgroundUpgrade && !res.synced && res.lyrics.length <= existingLen) {
            return;
          }
          setLyricsSynced(res.synced);
          setLyricsStatus('loaded');
          setCurrentTrack((prev) =>
            prev.id === targetTrack.id ? { ...prev, lyrics: res.lyrics } : prev
          );
          setQueue((prevQ) =>
            prevQ.map((item) => (item.id === targetTrack.id ? { ...item, lyrics: res.lyrics } : item))
          );
        } else if (!opts?.backgroundUpgrade || currentTrackRef.current.lyrics.length === 0) {
          setLyricsSynced(false);
          setLyricsStatus('unavailable');
        }
      } catch {
        if (
          currentTrackRef.current.id === targetTrack.id &&
          (!opts?.backgroundUpgrade || currentTrackRef.current.lyrics.length === 0)
        ) {
          setLyricsStatus('unavailable');
        }
      }
    },
    []
  );

  const handleRetryCurrentLyrics = useCallback(
    (customTitle?: string, customArtist?: string) => {
      const tr = currentTrackRef.current;
      resolveLyricsForTrack(tr, {
        customTitle,
        customArtist,
        forceRefresh: true
      });
    },
    [resolveLyricsForTrack]
  );

  // Hydrate initial track lyrics quietly if initial catalog entry has sparse or teaser lines
  useEffect(() => {
    const tr = currentTrackRef.current;
    if (tr.lyrics.length < 18) {
      if (tr.lyrics.length > 0) {
        setLyricsStatus('loaded');
        setLyricsSynced(tr.lyrics.length > 4);
      }
      resolveLyricsForTrack(tr, { backgroundUpgrade: tr.lyrics.length > 0 });
    }
  }, [resolveLyricsForTrack]);

  const activateMusicVideoForTrack = useCallback(
    async (track: Track, explicitResumeSec?: number) => {
      if (!track) return;
      if (track.videoUrl && !track.videoUrl.includes('mixkit.co') && !track.youtubeId) {
        return;
      }

      const mvToken = ++mvSelectionTokenRef.current;
      if (mvResolveAbortRef.current) {
        mvResolveAbortRef.current.abort();
      }
      const ac = new AbortController();
      mvResolveAbortRef.current = ac;

      const resumeAt =
        typeof explicitResumeSec === 'number' && Number.isFinite(explicitResumeSec)
          ? Math.max(0, Math.floor(explicitResumeSec))
          : Math.max(0, Math.floor(currentTimeRef.current));

      if (track.musicVideoCandidates && track.musicVideoCandidates.length > 0) {
        const candidateIds = track.musicVideoCandidates.map((c) => c.videoId);
        const activeId = sharedAudioEngine.getCurrentYouTubeVideoId();
        if (isYouTubeActive && candidateIds.includes(activeId)) {
          return;
        }
        setResolvingVideoTrackId(null);
        setIsYouTubeActive(true);
        await sharedAudioEngine.playYouTubeTrack(
          candidateIds,
          track.musicVideoCandidates[0].duration || track.duration,
          track.bpm,
          resumeAt
        );
        setIsPlaying(true);
        return;
      }

      setResolvingVideoTrackId(track.id);
      try {
        const resolved = await resolveMusicVideoStream(
          track.title,
          track.artist,
          track.duration,
          ac.signal
        );
        if (
          ac.signal.aborted ||
          mvToken !== mvSelectionTokenRef.current ||
          currentTrackRef.current.id !== track.id
        ) {
          return;
        }
        if (!resolved || resolved.candidateIds.length === 0) {
          showToast(t.videoUnavailable, 'warning');
          return;
        }
        setCurrentTrack((prev) =>
          prev.id === track.id
            ? {
                ...prev,
                musicVideoId: resolved.youtubeId,
                musicVideoCandidates: resolved.candidates
              }
            : prev
        );
        setQueue((prev) =>
          prev.map((q) =>
            q.id === track.id
              ? {
                  ...q,
                  musicVideoId: resolved.youtubeId,
                  musicVideoCandidates: resolved.candidates
                }
              : q
          )
        );
        setIsYouTubeActive(true);
        const liveResume =
          typeof explicitResumeSec === 'number' && Number.isFinite(explicitResumeSec)
            ? Math.max(0, Math.floor(explicitResumeSec))
            : Math.max(0, Math.floor(currentTimeRef.current));
        await sharedAudioEngine.playYouTubeTrack(
          resolved.candidateIds,
          resolved.duration || track.duration,
          track.bpm,
          liveResume
        );
        setIsPlaying(true);
      } catch {
        if (!ac.signal.aborted && mvToken === mvSelectionTokenRef.current) {
          showToast(t.videoUnavailable, 'warning');
        }
      } finally {
        if (mvToken === mvSelectionTokenRef.current) {
          setResolvingVideoTrackId(null);
        }
      }
    },
    [isYouTubeActive, showToast, t.videoUnavailable]
  );

  const handleSelectVideoCandidate = useCallback((videoId: string) => {
    const tr = currentTrackRef.current;
    const candidateIds = (tr.musicVideoCandidates || []).map((c) => c.videoId);
    if (!videoId) return;
    setIsYouTubeActive(true);
    void sharedAudioEngine.switchYouTubeCandidate(
      videoId,
      candidateIds.length > 0 ? candidateIds : [videoId],
      tr.duration,
      tr.bpm,
      Math.max(0, Math.floor(currentTimeRef.current))
    );
    setIsPlaying(true);
  }, []);

  const handleSwitchToAudioMaster = useCallback(() => {
    const tr = currentTrackRef.current;
    ++mvSelectionTokenRef.current;
    if (mvResolveAbortRef.current) {
      mvResolveAbortRef.current.abort();
      mvResolveAbortRef.current = null;
    }
    setResolvingVideoTrackId(null);

    if (tr.audioUrl) {
      const resumeAt = Math.max(0, Math.floor(currentTimeRef.current));
      setIsYouTubeActive(false);
      sharedAudioEngine.playTrack(tr.duration, tr.bpm, tr.audioUrl);
      if (resumeAt > 0) {
        sharedAudioEngine.seek(resumeAt);
      }
      setStageMode('music-lyric');
      setIsPlaying(true);
      return;
    }

    setStageMode('music-lyric');
  }, []);

  const handleRequestVideoFullscreen = useCallback(() => {
    const host = ytHostRef.current;
    if (!host) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      host.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const handleSelectTrack = useCallback(
    async (
      track: Track,
      options?: { skipHistoryPush?: boolean; fromEnded?: boolean; fromContextList?: boolean }
    ) => {
      const selectionSeq = ++selectionCounterRef.current;
      ++mvSelectionTokenRef.current;
      if (mvResolveAbortRef.current) {
        mvResolveAbortRef.current.abort();
        mvResolveAbortRef.current = null;
      }
      setResolvingVideoTrackId(null);
      const isVideoStageActive =
        isStageVisibleRef.current &&
        (stageModeRef.current === 'video-only' || stageModeRef.current === 'video-lyric');
      resolveAbortRef.current?.abort();
      resolveAbortRef.current = null;
      resolvingTrackIdRef.current = null;
      setResolvingTrackId(null);
      loadedTrackIdRef.current = track.id;
      discoveredPoolRef.current.set(track.id, track);
      if (!options?.fromEnded) {
        autoRetryCountRef.current = 0;
      }

      const prevTrack = currentTrackRef.current;
      const elapsedSeconds = currentTimeRef.current;
      if (prevTrack && prevTrack.id !== track.id) {
        if (!options?.skipHistoryPush) {
          setPlayHistory((prev) => [...prev.slice(-29), prevTrack]);
        }
        setRecState((prev) => {
          let nextState = prev;
          if (
            options?.fromEnded ||
            elapsedSeconds >= 25 ||
            (prevTrack.duration > 0 && elapsedSeconds / prevTrack.duration >= 0.65)
          ) {
            nextState = recordTrackSignal(nextState, prevTrack, 'complete');
          } else if (elapsedSeconds >= 2 && elapsedSeconds < 18) {
            nextState = recordTrackSignal(nextState, prevTrack, 'earlySkip');
          }
          return recordTrackSignal(nextState, track, 'play');
        });
      } else {
        setRecState((prev) => recordTrackSignal(prev, track, 'play'));
      }

      setStreamError(null);
      setCurrentTrack(track);
      setCurrentTime(0);

      if (track.sourceTag !== 'live-radio' && playbackContextRef.current.type !== 'radio') {
        setActiveRadioStationId(null);
      }

      mutateNeonLibrary('record_play', { track }).then((snap) => {
        if (snap && snap.connected) {
          setCloudConnected(true);
          setCloudStats(snap.stats);
        }
      });

      const isSingleStandalonePlay =
        !options?.fromContextList &&
        track.sourceTag !== 'live-radio' &&
        track.genre !== 'Podcast';

      if (isSingleStandalonePlay) {
        const autoCtx = buildAutoSimilarContext(track);
        playbackContextRef.current = autoCtx;
        setPlaybackContext(autoCtx);

        const seedTier = classifyTrackTier(track);
        const seedLang = inferTrackLanguageRegion(track);
        const instantPool = gatherLocalCandidatePool(track.id);
        const langAndClassInstant = instantPool.filter((cand) => {
          const ct = classifyTrackTier(cand);
          const classOk = ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
          if (!classOk) return false;
          if (seedLang !== 'en' && seedLang !== 'instrumental') {
            return inferTrackLanguageRegion(cand) === seedLang;
          }
          return true;
        });
        const classMatchedInstant =
          langAndClassInstant.length >= 3
            ? langAndClassInstant
            : instantPool.filter((cand) => {
                const ct = classifyTrackTier(cand);
                return ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
              });
        const rankedInstant = buildSmartQueueFromPool(
          track,
          classMatchedInstant.length >= 3 ? classMatchedInstant : instantPool,
          recStateRef.current.recentTracks,
          recStateRef.current,
          activeMoodRef.current,
          18
        );
        const nextQueue = [track, ...rankedInstant];
        queueRef.current = nextQueue;
        setQueue(nextQueue);
        refillRadioQueueIfNeeded(track, true);
      } else {
        setQueue((prevQueue) => {
          if (!prevQueue.some((t) => t.id === track.id)) {
            const nextQ = [track, ...prevQueue];
            queueRef.current = nextQ;
            return nextQ;
          }
          return prevQueue;
        });

        const ctxType = playbackContextRef.current.type;
        if (ctxType === 'radio' && track.sourceTag !== 'live-radio') {
          refillRadioQueueIfNeeded(track, false);
        } else if (
          autoplayEnabledRef.current &&
          recStateRef.current.repeatMode !== 'one' &&
          track.sourceTag !== 'live-radio' &&
          track.genre !== 'Podcast'
        ) {
          // Preload peer class candidates into discoveredPool before an ordered album/playlist finishes
          const q = queueRef.current;
          const idx = q.findIndex((t) => t.id === track.id);
          if (idx >= 0 && q.length - 1 - idx <= 1) {
            const peerQueries = getClassMatchedSeedQueries(track, activeMoodRef.current, 2);
            Promise.allSettled(peerQueries.map((pq) => searchTracksOnline(pq))).then((batches) => {
              for (const b of batches) {
                if (b.status === 'fulfilled' && Array.isArray(b.value)) {
                  for (const cand of b.value) {
                    if (cand && cand.id) discoveredPoolRef.current.set(cand.id, cand);
                  }
                }
              }
            });
          }
        }
      }

      if (track.sourceTag === 'live-radio' || track.genre === 'Podcast') {
        resolvedLyricsMetaRef.current = { trackId: track.id, fetchDur: track.duration };
        setLyricsStatus(track.lyrics.length > 0 ? 'loaded' : 'idle');
        setLyricsSynced(track.lyrics.length > 4);
      } else if (track.lyrics.length < 18) {
        if (track.lyrics.length > 0) {
          setLyricsStatus('loaded');
          setLyricsSynced(track.lyrics.length > 4);
        }
        resolveLyricsForTrack(track, { backgroundUpgrade: track.lyrics.length > 0 });
      } else {
        resolvedLyricsMetaRef.current = { trackId: track.id, fetchDur: track.duration };
        setLyricsStatus('loaded');
        setLyricsSynced(track.lyrics.length > 4);
      }

      // Silently pre-fetch lyrics for next track in queue so Up Next starts instantaneously
      const qAfter = queueRef.current;
      const curIdxInQ = qAfter.findIndex((item) => item.id === track.id);
      const nextPreviewTrack = curIdxInQ >= 0 ? qAfter[curIdxInQ + 1] : qAfter[0];
      if (
        nextPreviewTrack &&
        nextPreviewTrack.id !== track.id &&
        nextPreviewTrack.lyrics.length <= 2 &&
        nextPreviewTrack.sourceTag !== 'live-radio' &&
        nextPreviewTrack.genre !== 'Podcast'
      ) {
        fetchLyricsWithMeta(
          nextPreviewTrack.title,
          nextPreviewTrack.artist,
          nextPreviewTrack.duration,
          nextPreviewTrack.album
        )
          .then((prefetched) => {
            if (prefetched.lyrics.length > 0) {
              setQueue((prevQ) =>
                prevQ.map((item) =>
                  item.id === nextPreviewTrack.id && item.lyrics.length <= 2
                    ? { ...item, lyrics: prefetched.lyrics }
                    : item
                )
              );
            }
          })
          .catch(() => { });
      }

      const fallbackYtIds =
        track.candidateVideoIds && track.candidateVideoIds.length > 0
          ? track.candidateVideoIds
          : track.youtubeId
            ? [track.youtubeId]
            : undefined;

      // 1. Direct Studio Master MP3, Live Broadcast Stream, or local user file
      if (track.audioUrl) {
        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);
        setIsYouTubeActive(false);
        sharedAudioEngine.playTrack(track.duration, track.bpm, track.audioUrl, fallbackYtIds, {
          isLiveStream: track.sourceTag === 'live-radio',
          fallbackAudioUrl: track.fallbackAudioUrl
        });
        if (isVideoStageActive && track.sourceTag !== 'live-radio') {
          void activateMusicVideoForTrack(track, 0);
        } else if (
          track.genre !== 'Podcast' &&
          track.sourceTag !== 'live-radio' &&
          !(track.musicVideoCandidates && track.musicVideoCandidates.length > 0)
        ) {
          window.setTimeout(() => {
            if (selectionSeq !== selectionCounterRef.current) return;
            void resolveMusicVideoStream(track.title, track.artist, track.duration).catch(() => { });
          }, 650);
        }
        return;
      }

      // 2. Check bundled master fallback by exact title + artist
      const masterMatch = findMasterAudio(track.title, track.artist);
      if (masterMatch) {
        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);
        setIsYouTubeActive(false);
        const updatedTrack: Track = {
          ...track,
          audioUrl: masterMatch.audioUrl,
          duration: masterMatch.duration,
          streamSource: 'studio-master'
        };
        setCurrentTrack(updatedTrack);
        setQueue((prevQ) => prevQ.map((t) => (t.id === track.id ? updatedTrack : t)));
        sharedAudioEngine.playTrack(
          updatedTrack.duration,
          updatedTrack.bpm,
          updatedTrack.audioUrl,
          fallbackYtIds
        );
        if (isVideoStageActive) {
          void activateMusicVideoForTrack(updatedTrack, 0);
        } else if (
          !(updatedTrack.musicVideoCandidates && updatedTrack.musicVideoCandidates.length > 0)
        ) {
          window.setTimeout(() => {
            if (selectionSeq !== selectionCounterRef.current) return;
            void resolveMusicVideoStream(
              updatedTrack.title,
              updatedTrack.artist,
              updatedTrack.duration
            ).catch(() => { });
          }, 650);
        }
        return;
      }

      // 3. Pre-resolved candidate YouTube official stream IDs (explicit or warm cache)
      const existingIds =
        track.candidateVideoIds && track.candidateVideoIds.length > 0
          ? track.candidateVideoIds
          : track.youtubeId
            ? [track.youtubeId]
            : [];
      const cachedStream =
        !isVideoStageActive && existingIds.length === 0
          ? peekCachedTrackStream(track.title, track.artist)
          : null;
      const readyIds =
        existingIds.length > 0 ? existingIds : cachedStream?.candidateIds || [];

      if (readyIds.length > 0) {
        const readyDuration =
          track.duration >= 60 ? track.duration : cachedStream?.duration || track.duration;
        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);
        if (isVideoStageActive) {
          void activateMusicVideoForTrack(track, 0);
        } else {
          setIsYouTubeActive(true);
          sharedAudioEngine.playYouTubeTrack(readyIds, readyDuration, track.bpm);
          if (existingIds.length === 0 && cachedStream) {
            const hydratedTrack: Track = {
              ...track,
              youtubeId: cachedStream.youtubeId,
              candidateVideoIds: cachedStream.candidateIds,
              duration: readyDuration,
              streamSource: 'official-stream'
            };
            setCurrentTrack((prev) =>
              prev.id === track.id
                ? {
                    ...hydratedTrack,
                    lyrics: prev.lyrics.length > hydratedTrack.lyrics.length ? prev.lyrics : hydratedTrack.lyrics
                  }
                : prev
            );
            setQueue((prevQ) =>
              prevQ.map((t) =>
                t.id === track.id
                  ? {
                      ...hydratedTrack,
                      lyrics: t.lyrics.length > hydratedTrack.lyrics.length ? t.lyrics : hydratedTrack.lyrics
                    }
                  : t
              )
            );
          }
        }
        if (readyIds.length < 4 && track.genre !== 'Podcast' && track.sourceTag !== 'live-radio') {
          const activeGen = sharedAudioEngine.getPlayGeneration();
          resolveFullTrackStream(track.title, track.artist, readyDuration)
            .then((resolved) => {
              if (!resolved || selectionSeq !== selectionCounterRef.current) return;
              sharedAudioEngine.appendCandidateIds(resolved.candidateIds, activeGen);
            })
            .catch(() => { });
        }
        return;
      }

      // 4. Resolve 100% full-length official stream dynamically without dropping background audio focus
      sharedAudioEngine.prepareTrackTransition(track.duration, track.bpm);
      const abortCtrl = new AbortController();
      resolveAbortRef.current = abortCtrl;
      resolvingStartedAtRef.current = Date.now();
      resolvingTrackIdRef.current = track.id;
      setResolvingTrackId(track.id);
      setIsYouTubeActive(true);
      const canAutoSkipError =
        recStateRef.current.repeatMode !== 'one' &&
        (autoplayEnabledRef.current ||
          queueRef.current.length > 1 ||
          manualQueueRef.current.length > 0);
      try {
        const mvResolved = isVideoStageActive
          ? await resolveMusicVideoStream(
              track.title,
              track.artist,
              track.duration,
              abortCtrl.signal
            )
          : null;
        const resolved =
          mvResolved ||
          (await resolveFullTrackStream(
            track.title,
            track.artist,
            track.duration,
            abortCtrl.signal
          ));
        if (selectionSeq !== selectionCounterRef.current || abortCtrl.signal.aborted) return;

        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);

        if (resolved && resolved.candidateIds.length > 0) {
          const updatedTrack: Track = {
            ...track,
            youtubeId: resolved.youtubeId,
            candidateVideoIds: resolved.candidateIds,
            duration: resolved.duration,
            streamSource: 'official-stream',
            ...(mvResolved
              ? {
                  musicVideoId: mvResolved.youtubeId,
                  musicVideoCandidates: mvResolved.candidates
                }
              : {})
          };
          setCurrentTrack((prev) =>
            prev.id === track.id
              ? {
                  ...updatedTrack,
                  lyrics: prev.lyrics.length > updatedTrack.lyrics.length ? prev.lyrics : updatedTrack.lyrics
                }
              : prev
          );
          setQueue((prevQ) =>
            prevQ.map((t) =>
              t.id === track.id
                ? {
                    ...updatedTrack,
                    lyrics: t.lyrics.length > updatedTrack.lyrics.length ? t.lyrics : updatedTrack.lyrics
                  }
                : t
            )
          );
          sharedAudioEngine.playYouTubeTrack(resolved.candidateIds, resolved.duration, track.bpm);
          if (Math.abs(resolved.duration - track.duration) >= 5) {
            resolveLyricsForTrack(updatedTrack, {
              backgroundUpgrade: currentTrackRef.current.lyrics.length > 0,
              overrideDuration: resolved.duration
            });
          }
        } else {
          setIsYouTubeActive(false);
          setStreamError('Full official stream unavailable for this release. Try another track.');
          sharedAudioEngine.pause();
          if (canAutoSkipError && autoRetryCountRef.current < 4) {
            autoRetryCountRef.current += 1;
            window.setTimeout(() => handleNextRef.current(true), 350);
          }
        }
      } catch {
        if (selectionSeq !== selectionCounterRef.current) return;
        resolvingTrackIdRef.current = null;
        setResolvingTrackId(null);
        setIsYouTubeActive(false);
        setStreamError('Unable to resolve full-length stream. Try another release.');
        sharedAudioEngine.pause();
        if (canAutoSkipError && autoRetryCountRef.current < 4) {
          autoRetryCountRef.current += 1;
          window.setTimeout(() => handleNextRef.current(true), 350);
        }
      } finally {
        if (selectionSeq === selectionCounterRef.current) {
          if (resolveAbortRef.current === abortCtrl) {
            resolveAbortRef.current = null;
          }
          resolvingTrackIdRef.current = null;
          setResolvingTrackId(null);
        }
      }
    }, [activateMusicVideoForTrack, buildAutoSimilarContext, gatherLocalCandidatePool, refillRadioQueueIfNeeded, resolveLyricsForTrack]);

  const handleSelectRadio = (station: RadioStation, mode?: 'live' | 'mix') => {
    const resolvedMode = mode || (station.streamUrl ? 'live' : 'mix');
    setActiveRadioStationId(station.id);

    if (resolvedMode === 'live' && station.streamUrl) {
      if (
        isStageVisibleRef.current &&
        (stageModeRef.current === 'video-only' || stageModeRef.current === 'video-lyric')
      ) {
        setStageMode('orbwave-only');
      }
      const liveTrack: Track = {
        ...station.currentTrack,
        id: `live-${station.id}`,
        title: station.name,
        artist: station.city ? `${station.genre} · ${station.city}` : station.genre,
        album: station.tagline,
        duration: 0,
        coverUrl: station.faviconUrl || station.currentTrack.coverUrl,
        audioUrl: station.streamUrl,
        fallbackAudioUrl: station.fallbackStreamUrl,
        youtubeId: undefined,
        candidateVideoIds: undefined,
        musicVideoId: undefined,
        musicVideoCandidates: undefined,
        streamSource: 'official-stream',
        sourceTag: 'live-radio',
        genre: 'Live Radio',
        lyrics: [{ time: 0, text: `${station.name} — Live 24/7 Broadcast` }]
      };
      playbackContextRef.current = {
        type: 'radio',
        id: station.id,
        title: station.name,
        subtitle: station.city ? `${station.city} · Live Broadcast` : 'Live Broadcast'
      };
      setPlaybackContext(playbackContextRef.current);
      handleSelectTrack(liveTrack, { fromContextList: true });
      return;
    }

    handleStartRadio(station.currentTrack, {
      id: station.id,
      title: station.name,
      subtitle: station.city ? `${station.city} · ${station.genre}` : station.genre
    });
  };

  const handleSelectPodcast = (episode: PodcastEpisode, openVideoStage?: boolean) => {
    const videoCandidates: MusicVideoCandidate[] =
      episode.videoCandidates && episode.videoCandidates.length > 0
        ? episode.videoCandidates
        : episode.youtubeId
          ? [
              {
                videoId: episode.youtubeId,
                title: episode.title,
                author: episode.host || episode.podcastName,
                duration: episode.duration,
                thumbnail: episode.coverUrl
              }
            ]
          : [];
    const shouldOpenVideo = Boolean(openVideoStage && (episode.youtubeId || videoCandidates.length > 0));
    const podTrack: Track = {
      id: episode.id,
      title: episode.title,
      artist: episode.host,
      album: episode.podcastName,
      duration: episode.duration,
      coverUrl: episode.coverUrl,
      audioUrl: shouldOpenVideo ? undefined : episode.audioUrl,
      videoUrl: episode.videoUrl,
      youtubeId: episode.youtubeId,
      musicVideoId: episode.youtubeId,
      candidateVideoIds: episode.youtubeId ? [episode.youtubeId] : undefined,
      musicVideoCandidates: videoCandidates.length > 0 ? videoCandidates : undefined,
      streamSource: episode.youtubeId || episode.audioUrl ? 'official-stream' : undefined,
      genre: 'Podcast',
      lyrics: episode.transcript,
      artistSolanaAddress: episode.hostSolanaAddress,
      bpm: 90
    };
    handleSelectTrack(podTrack, { fromContextList: true });
    if (shouldOpenVideo) {
      setStageMode('video-lyric');
      setIsStageOpen(true);
      setIsFloatingMinimized(false);
      mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUploadTrack = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const parts = fileName.split('-').map((s) => s.trim());
    const artist = parts.length > 1 ? parts[0] : 'Local Artist';
    const title = parts.length > 1 ? parts.slice(1).join(' - ') : parts[0];

    const newTrack: Track = {
      id: `local-${Date.now()}`,
      title,
      artist,
      album: 'Local Library Upload',
      duration: 210,
      coverUrl:
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
      audioUrl: objectUrl,
      streamSource: 'local-upload',

      genre: 'Custom Audio',
      bpm: 120,
      artistSolanaAddress: '',
      lyrics: [
        { time: 0, text: `Playing local file: ${file.name}` },
        { time: 5, text: 'Loaded with full 60 FPS Web Audio spectrum analysis' },
        { time: 12, text: 'Zero server upload required · 100% Client-Side DSP' }
      ]
    };

    fetchLyricsWithMeta(title, artist, 210).then((res) => {
      if (res.lyrics.length > 0) {
        setCurrentTrack((prev) => (prev.id === newTrack.id ? { ...prev, lyrics: res.lyrics } : prev));
      }
    });

    handleSelectTrack(newTrack);
  };

  const handleTogglePlay = useCallback(() => {
    if (resolvingTrackIdRef.current) {
      resolveAbortRef.current?.abort();
      resolveAbortRef.current = null;
      resolvingTrackIdRef.current = null;
      setResolvingTrackId(null);
      handleSelectTrack(currentTrackRef.current, {
        skipHistoryPush: true,
        fromContextList: queueRef.current.some((q) => q.id === currentTrackRef.current.id)
      });
      return;
    }

    if (sharedAudioEngine.getIsPlaying()) {
      sharedAudioEngine.pause();
      return;
    }

    const active = currentTrackRef.current;
    if (
      sharedAudioEngine.getActiveBackend() !== 'none' &&
      loadedTrackIdRef.current === active.id &&
      currentTimeRef.current < Math.max(1, active.duration - 1)
    ) {
      sharedAudioEngine.resume(true);
    } else {
      handleSelectTrack(active, {
        skipHistoryPush: true,
        fromContextList: queueRef.current.some((q) => q.id === active.id)
      });
    }
  }, [handleSelectTrack]);

  useEffect(() => {
    handleTogglePlayRef.current = handleTogglePlay;
  }, [handleTogglePlay]);

  const handleNext = useCallback(
    async (fromEnded = false) => {
      if (fromEnded && recStateRef.current.repeatMode === 'one') {
        sharedAudioEngine.seek(0);
        setCurrentTime(0);
        sharedAudioEngine.resume();
        return;
      }

      if (recStateRef.current.repeatMode === 'off') {
        const curIdx = queueRef.current.findIndex((t) => t.id === currentTrackRef.current.id);
        const atQueueEnd = curIdx === queueRef.current.length - 1 || curIdx === -1;
        if (atQueueEnd && manualQueueRef.current.length === 0) {
          if (fromEnded) {
            setRecState((prev) => recordTrackSignal(prev, currentTrackRef.current, 'complete'));
          }
          const curCtx = playbackContextRef.current;
          const isExplicitFiniteList =
            Boolean(curCtx?.ordered) &&
            (curCtx?.type === 'album' || curCtx?.type === 'playlist');
          if (autoplayEnabledRef.current || !isExplicitFiniteList) {
            const seed = currentTrackRef.current;
            const autoCtx = buildAutoSimilarContext(seed);
            playbackContextRef.current = autoCtx;
            setPlaybackContext(autoCtx);

            const seedTier = classifyTrackTier(seed);
            const seedLang = inferTrackLanguageRegion(seed);
            const localPool = gatherLocalCandidatePool(seed.id);
            const strictPool = localPool.filter((cand) => {
              const ct = classifyTrackTier(cand);
              const classOk =
                ct.classId === seedTier.classId ||
                seedTier.compatibleClasses.includes(ct.classId);
              if (!classOk) return false;
              if (seedLang !== 'en' && seedLang !== 'instrumental') {
                return inferTrackLanguageRegion(cand) === seedLang;
              }
              return true;
            });
            let pool =
              strictPool.length >= 4
                ? strictPool
                : localPool.filter((cand) => {
                    const ct = classifyTrackTier(cand);
                    return (
                      ct.classId === seedTier.classId ||
                      seedTier.compatibleClasses.includes(ct.classId)
                    );
                  });

            if (pool.length < 4) {
              pool = localPool;
              const liveQueries = getClassMatchedSeedQueries(seed, activeMoodRef.current, 3);
              void Promise.allSettled(liveQueries.map((q) => searchTracksOnline(q))).then((batches) => {
                for (const b of batches) {
                  if (b.status === 'fulfilled' && Array.isArray(b.value)) {
                    for (const item of b.value) {
                      if (item && item.id) {
                        discoveredPoolRef.current.set(item.id, item);
                      }
                    }
                  }
                }
              });
            }

            const rankedPool = buildSmartQueueFromPool(
              seed,
              pool,
              recStateRef.current.recentTracks,
              recStateRef.current,
              activeMoodRef.current,
              16
            );
            const existingIds = new Set(queueRef.current.map((existing) => existing.id));
            let additions = rankedPool.filter((t) => !existingIds.has(t.id));
            if (additions.length === 0) {
              const fallbackPool = gatherLocalCandidatePool(seed.id).filter(
                (t) => !existingIds.has(t.id)
              );
              additions = fallbackPool.slice(0, 10);
            }
            const nextAuto =
              additions[0] ||
              rankedPool.find((t) => t.id !== seed.id) ||
              queueRef.current.find((t) => t.id !== seed.id);
            if (nextAuto) {
              if (additions.length > 0) {
                const extendedQueue = [...queueRef.current, ...additions].slice(-60);
                queueRef.current = extendedQueue;
                setQueue(extendedQueue);
              }
              handleSelectTrack(nextAuto, { fromEnded, fromContextList: true });
              refillRadioRef.current(nextAuto, true);
              return;
            }
          }
          return;
        }
      }

      const decision = pickNextTrackPure({
        currentTrack: currentTrackRef.current,
        queue: queueRef.current,
        manualQueue: manualQueueRef.current,
        recentTracks: recStateRef.current.recentTracks,
        state: recStateRef.current,
        mood: activeMoodRef.current
      });

      if (decision.shouldRestartCurrent) {
        sharedAudioEngine.seek(0);
        setCurrentTime(0);
        sharedAudioEngine.resume();
        return;
      }

      if (decision.consumedManual) {
        setManualQueue((prev) => prev.slice(1));
      }

      handleSelectTrack(decision.nextTrack, { fromEnded, fromContextList: true });
    },
    [buildAutoSimilarContext, gatherLocalCandidatePool, handleSelectTrack]
  );

  const handlePrev = useCallback(() => {
    if (sharedAudioEngine.getCurrentTime() > 3) {
      sharedAudioEngine.seek(0);
      setCurrentTime(0);
      return;
    }

    const history = playHistoryRef.current;
    if (history.length > 0) {
      const target = history[history.length - 1];
      setPlayHistory((prev) => prev.slice(0, -1));
      handleSelectTrack(target, { skipHistoryPush: true, fromContextList: true });
      return;
    }

    const currentIndex = queueRef.current.findIndex((t) => t.id === currentTrackRef.current.id);
    const prevIndex = (currentIndex - 1 + queueRef.current.length) % queueRef.current.length;
    handleSelectTrack(queueRef.current[prevIndex], { skipHistoryPush: true, fromContextList: true });
  }, [handleSelectTrack]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleToggleLike = useCallback(
    (track: Track) => {
      setRecState((prev) => recordTrackSignal(prev, track, 'toggleLike'));
      void runCloudMutation('toggle_favorite', { track });
    },
    [runCloudMutation]
  );

  const handleTogglePin = useCallback(
    (trackId: string, pinned: boolean) => {
      setFavoritesMeta((prev) =>
        prev.map((f) => (f.id === trackId ? { ...f, pinned } : f))
      );
      void runCloudMutation('update_favorite_meta', { trackId, pinned });
    },
    [runCloudMutation]
  );

  const handleSaveFavoriteNote = useCallback(
    (trackId: string, note: string) => {
      setFavoritesMeta((prev) =>
        prev.map((f) => (f.id === trackId ? { ...f, note } : f))
      );
      void runCloudMutation('update_favorite_meta', { trackId, note });
    },
    [runCloudMutation]
  );

  const handleAddToQueue = useCallback((track: Track) => {
    setManualQueue((prev) => (prev.some((x) => x.id === track.id) ? prev : [...prev, track]));
    setRecState((prev) => recordTrackSignal(prev, track, 'queueAdd'));
  }, []);

  const handlePlayNext = useCallback(
    (track: Track) => {
      setManualQueue((prev) => [track, ...prev.filter((x) => x.id !== track.id)]);
      setRecState((prev) => recordTrackSignal(prev, track, 'queueAdd'));
      showToast(`${t.playNext}: ${track.title}`, 'success');
    },
    [showToast, t.playNext]
  );

  const handleRemoveFromManualQueue = useCallback((index: number) => {
    setManualQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveUpcomingTrack = useCallback((trackId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== trackId));
  }, []);

  const currentTrackOffsetKey = `${currentTrack.artist.trim().toLowerCase()}::${currentTrack.title
    .trim()
    .toLowerCase()}`;
  const currentLyricsOffset = lyricOffsetsByTrack[currentTrackOffsetKey] || 0;

  const handleChangeCurrentLyricsOffset = useCallback(
    (nextOffset: number) => {
      const clamped = Math.max(-45, Math.min(45, Math.round(nextOffset * 10) / 10));
      setLyricOffsetsByTrack((prev) => {
        const copy = { ...prev };
        if (Math.abs(clamped) < 0.05) {
          delete copy[currentTrackOffsetKey];
        } else {
          copy[currentTrackOffsetKey] = clamped;
        }
        try {
          window.localStorage.setItem('sonacast_lyric_offsets_v1', JSON.stringify(copy));
        } catch {
          // Ignore storage quota errors
        }
        return copy;
      });
    },
    [currentTrackOffsetKey]
  );

  const handleImportLibrary = useCallback(
    (payload: {
      favorites?: FavoriteTrack[];
      albums?: UserPlaylist[];
      followedArtists?: FollowedArtist[];
    }) => {
      let importedAlbums = 0;
      let importedFavorites = 0;
      const incomingFavs = Array.isArray(payload.favorites)
        ? payload.favorites.filter((item) => Boolean(item?.id && item?.title))
        : [];
      const incomingAlbums = Array.isArray(payload.albums)
        ? payload.albums.filter((alb) => alb?.id && alb?.name && Array.isArray(alb.tracks))
        : [];
      const incomingArtists = Array.isArray(payload.followedArtists)
        ? payload.followedArtists.filter((art) => Boolean(art?.name))
        : [];

      if (incomingFavs.length > 0) {
        setFavoritesMeta((prev) => {
          const map = new Map<string, FavoriteTrack>(prev.map((item) => [item.id, item]));
          for (const fav of incomingFavs) {
            if (!map.has(fav.id)) importedFavorites += 1;
            map.set(fav.id, fav);
          }
          return Array.from(map.values());
        });
      }

      if (incomingAlbums.length > 0 || incomingFavs.length > 0) {
        setRecState((prev) => {
          const likedMap = new Map<string, Track>(prev.likedTracks.map((tr) => [tr.id, tr]));
          for (const fav of incomingFavs) {
            if (!likedMap.has(fav.id)) {
              likedMap.set(fav.id, fav);
            }
          }
          const playlistMap = new Map<string, UserPlaylist>(
            prev.playlists.map((pl) => [pl.id, pl])
          );
          for (const alb of incomingAlbums) {
            if (!playlistMap.has(alb.id)) {
              importedAlbums += 1;
            }
            playlistMap.set(alb.id, alb);
          }
          const next = {
            ...prev,
            likedTracks: Array.from(likedMap.values()),
            playlists: Array.from(playlistMap.values())
          };
          saveRecommendationState(next);
          return next;
        });
      }

      if (incomingArtists.length > 0) {
        setFollowedArtists((prev) => {
          const map = new Map<string, FollowedArtist>(
            prev.map((art) => [art.name.toLowerCase(), art])
          );
          for (const art of incomingArtists) {
            map.set(art.name.toLowerCase(), art);
          }
          return Array.from(map.values());
        });
      }

      showToast(
        `Imported ${importedAlbums} album(s), ${importedFavorites} favorite(s)`,
        'success'
      );
      return { importedAlbums, importedFavorites };
    },
    [showToast]
  );

  const handleClearManualQueue = useCallback(() => {
    setManualQueue([]);
    showToast(t.clearQueue);
  }, [showToast, t.clearQueue]);

  const handleMoveManualQueueItem = useCallback((index: number, delta: -1 | 1) => {
    setManualQueue((prev) => {
      const target = index + delta;
      if (index < 0 || index >= prev.length || target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const handleOpenArtistSpotlight = useCallback((artistName: string) => {
    const clean = getPrimaryArtistName(artistName);
    if (clean) setArtistSpotlightName(clean);
  }, []);

  const handleOpenLyricCard = useCallback((lineIndex?: number) => {
    setLyricCardState({
      open: true,
      lineIndex: typeof lineIndex === 'number' ? lineIndex : null
    });
  }, []);

  const handleStartRadio = useCallback(
    (
      seedTrack: Track,
      stationMeta?: { id?: string; title?: string; subtitle?: string }
    ) => {
      const radioCtx: PlaybackContextInfo = {
        id: stationMeta?.id || `radio-${seedTrack.id}`,
        type: 'radio',
        title: stationMeta?.title || `Radio · ${seedTrack.title}`,
        subtitle: stationMeta?.subtitle || seedTrack.artist,
        coverUrl: seedTrack.coverUrl,
        ordered: false
      };
      playbackContextRef.current = radioCtx;
      setPlaybackContext(radioCtx);

      const smartNext = buildSmartQueueFromPool(
        seedTrack,
        [...queueRef.current, ...TRACK_CATALOG],
        recStateRef.current.recentTracks,
        recStateRef.current,
        activeMoodRef.current,
        24
      );
      const nextQueue = [seedTrack, ...smartNext];
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      if (seedTrack.id !== currentTrackRef.current.id) {
        handleSelectTrack(seedTrack, { fromContextList: true });
      }
      refillRadioQueueIfNeeded(seedTrack, true);
    },
    [handleSelectTrack, refillRadioQueueIfNeeded]
  );

  const handleRefreshRadioMix = useCallback(() => {
    const seed = currentTrackRef.current;
    const radioCtx: PlaybackContextInfo = {
      id: `radio-${seed.id}`,
      type: 'radio',
      title: `Radio · ${seed.title}`,
      subtitle: seed.artist,
      coverUrl: seed.coverUrl,
      ordered: false
    };
    playbackContextRef.current = radioCtx;
    setPlaybackContext(radioCtx);

    const smartNext = buildSmartQueueFromPool(
      seed,
      [...queueRef.current, ...TRACK_CATALOG],
      recStateRef.current.recentTracks,
      recStateRef.current,
      activeMoodRef.current,
      24
    );
    const nextQueue = [seed, ...smartNext];
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    refillRadioQueueIfNeeded(seed, true);
  }, [refillRadioQueueIfNeeded]);

  useEffect(() => {
    refillRadioRef.current = refillRadioQueueIfNeeded;
  }, [refillRadioQueueIfNeeded]);

  const handleSelectMood = useCallback(
    async (mood: MoodPreset) => {
      setActiveMood(mood);
      const queries = getMoodSeedQueries(mood);
      try {
        const fetched = await searchTracksOnline(queries[0]);
        if (fetched.length > 0) {
          const seed = fetched[0];
          const smartNext = buildSmartQueueFromPool(
            seed,
            [...fetched.slice(1), ...TRACK_CATALOG],
            recStateRef.current.recentTracks,
            recStateRef.current,
            mood,
            24
          );
          setQueue([seed, ...smartNext]);
          handleSelectTrack(seed, { fromContextList: true });
          return;
        }
      } catch {
        // Fallback to rebuilding existing queue under selected mood
      }
      const smartLocal = buildSmartQueueFromPool(
        currentTrackRef.current,
        [...queueRef.current, ...TRACK_CATALOG],
        recStateRef.current.recentTracks,
        recStateRef.current,
        mood,
        24
      );
      setQueue([currentTrackRef.current, ...smartLocal]);
    },
    [handleSelectTrack]
  );

  const handleToggleAutoplay = useCallback(() => {
    setAutoplayEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sonacast_autoplay_enabled', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const handlePlayTrackList = useCallback(
    (
      tracksList: Track[],
      shouldShuffle = false,
      contextInfo?: PlaybackContextInfo,
      startIndex = 0
    ) => {
      if (tracksList.length === 0) return;
      const orderedPlay = !shouldShuffle;
      const safeStart = Math.max(0, Math.min(startIndex, tracksList.length - 1));
      const resolvedTracks = shouldShuffle
        ? (() => {
          const copy = [...tracksList];
          const firstPick = copy.splice(safeStart, 1)[0];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return firstPick ? [firstPick, ...copy] : copy;
        })()
        : tracksList;

      const resolvedCtx: PlaybackContextInfo = contextInfo || {
        id: `list-${resolvedTracks[0]?.id || 'mix'}`,
        type: 'playlist',
        title: resolvedTracks[0]?.album || 'Ordered Collection',
        subtitle: `${resolvedTracks.length} tracks`,
        coverUrl: resolvedTracks[0]?.coverUrl,
        ordered: orderedPlay
      };

      setRecState((prev) => {
        const next = { ...prev, shuffle: shouldShuffle };
        saveRecommendationState(next);
        return next;
      });
      playbackContextRef.current = resolvedCtx;
      setPlaybackContext(resolvedCtx);
      queueRef.current = resolvedTracks;
      setQueue(resolvedTracks);

      const initialTrack = resolvedTracks[shouldShuffle ? 0 : safeStart] || resolvedTracks[0];
      handleSelectTrack(initialTrack, { fromContextList: true });
    },
    [handleSelectTrack]
  );

  const handleToggleShuffle = useCallback(() => {
    setRecState((prev) => {
      const next = { ...prev, shuffle: !prev.shuffle };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleCycleRepeat = useCallback(() => {
    setRecState((prev) => {
      const order: RepeatMode[] = ['all', 'one', 'off'];
      const nextMode = order[(order.indexOf(prev.repeatMode) + 1) % order.length];
      const next = { ...prev, repeatMode: nextMode };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleSelectEqPreset = useCallback((eqPreset: EqPreset) => {
    setRecState((prev) => {
      const next = { ...prev, eqPreset };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleSelectPlaybackRate = useCallback((playbackRate: number) => {
    setRecState((prev) => {
      const next = { ...prev, playbackRate };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleSelectCrossfade = useCallback((crossfadeSeconds: number) => {
    setRecState((prev) => {
      const next = { ...prev, crossfadeSeconds };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleSetSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        setSleepEndAtMs(null);
        setSleepMinutesRemaining(null);
        showToast(`${t.sleepTimer}: ${t.sleepOff}`);
      } else {
        setSleepEndAtMs(Date.now() + minutes * 60000);
        setSleepMinutesRemaining(minutes);
        showToast(`${t.sleepTimer}: ${minutes}m`, 'success');
      }
    },
    [showToast, t.sleepTimer, t.sleepOff]
  );

  const handleToggleNormalization = useCallback(() => {
    setNormalizationEnabled((prev) => {
      const next = !prev;
      sharedAudioEngine.setNormalization(next);
      showToast(`${t.normalizeVolume}: ${next ? 'ON' : 'OFF'}`, 'success');
      return next;
    });
  }, [showToast, t.normalizeVolume]);

  const handleToggleVocalReduction = useCallback(() => {
    setVocalReductionEnabled((prev) => {
      const next = !prev;
      sharedAudioEngine.setVocalReduction(next);
      showToast(`${t.karaokeMode}: ${next ? 'ON' : 'OFF'}`, 'success');
      return next;
    });
  }, [showToast, t.karaokeMode]);

  const handleToggleSaveOffline = useCallback(
    async (track: Track) => {
      if (!track.audioUrl || !isCacheableAudioUrl(track.audioUrl)) {
        showToast('Direct audio stream required for offline cache', 'warning');
        return;
      }
      if (isTrackSavedOffline(offlineAudioKeys, track.audioUrl)) {
        await removeTrackOffline(track.audioUrl);
        showToast(`${t.saveOffline}: ${track.title} removed`);
      } else {
        const ok = await saveTrackOffline(track.audioUrl);
        showToast(
          ok ? `${t.savedOffline}: ${track.title}` : 'Unable to cache audio offline',
          ok ? 'success' : 'warning'
        );
      }
    },
    [offlineAudioKeys, showToast, t.saveOffline, t.savedOffline]
  );

  const handleShareTrack = useCallback(
    async (track: Track) => {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}/?track=${encodeURIComponent(track.id)}`
          : `/?track=${encodeURIComponent(track.id)}`;
      try {
        await navigator.clipboard?.writeText(url);
      } catch {
        // Fallback when clipboard permission is denied
      }
      showToast(`${t.shareTrackLink}: ${track.title}`, 'success');
    },
    [showToast, t.shareTrackLink]
  );

  const handleCreatePlaylist = useCallback(
    (name: string, description = '', initialTrack?: Track) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setRecState((prev) => {
        const next: RecommendationState = {
          ...prev,
          playlists: [
            {
              id: `alb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: trimmed,
              description: description.trim(),
              coverUrl: initialTrack?.coverUrl || '',
              tracks: initialTrack ? [initialTrack] : [],
              createdAt: Date.now()
            },
            ...prev.playlists
          ]
        };
        saveRecommendationState(next);
        return next;
      });
      void runCloudMutation('create_album', {
        name: trimmed,
        description: description.trim(),
        initialTrack
      });
    },
    [runCloudMutation]
  );

  const handleSaveCatalogAlbum = useCallback(
    async (album: CatalogAlbum, prefetchedTracks?: Track[]) => {
      const targetName = album.title.trim();
      if (!targetName) return;
      const alreadyExists = recStateRef.current.playlists.some(
        (p) => p.name.trim().toLowerCase() === targetName.toLowerCase()
      );
      if (alreadyExists) {
        showToast(`${targetName} is already in Collection`, 'success');
        return;
      }

      let albumTracks = Array.isArray(prefetchedTracks) ? prefetchedTracks : [];
      if (albumTracks.length === 0) {
        try {
          const fetched = await fetchAlbumTracksOnline(album);
          albumTracks = fetched.tracks;
        } catch {
          albumTracks = [];
        }
      }

      const plId = `alb-cat-${album.id}-${Date.now().toString(36)}`;
      const description = `${album.artist}${album.genre ? ` · ${album.genre}` : ''}`;
      setRecState((prev) => {
        const withTracks: RecommendationState = {
          ...prev,
          playlists: [
            {
              id: plId,
              name: targetName,
              description,
              coverUrl: album.coverUrl || albumTracks[0]?.coverUrl || '',
              tracks: albumTracks,
              createdAt: Date.now()
            },
            ...prev.playlists
          ]
        };
        const updated = albumTracks[0]
          ? recordTrackSignal(withTracks, albumTracks[0], 'albumSave')
          : withTracks;
        saveRecommendationState(updated);
        return updated;
      });

      void runCloudMutation('create_album', {
        name: targetName,
        description,
        initialTrack: albumTracks[0]
      });
      showToast(`Saved album: ${targetName}`, 'success');
    },
    [runCloudMutation, showToast]
  );

  const handleSaveQueueAsPlaylist = useCallback(() => {
    const seen = new Set<string>();
    const combined: Track[] = [];
    for (const item of [currentTrack, ...manualQueue, ...queue]) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      combined.push(item);
      if (combined.length >= 40) break;
    }
    if (combined.length === 0) return;
    const baseName = playbackContext?.title ? `${playbackContext.title} Mix` : 'Queue Mix';
    const plId = `alb-q-${Math.random().toString(36).slice(2, 8)}`;
    setRecState((prev) => {
      const next: RecommendationState = {
        ...prev,
        playlists: [
          {
            id: plId,
            name: baseName,
            description: `${combined.length} tracks saved from queue`,
            coverUrl: combined[0]?.coverUrl || '',
            tracks: combined,
            createdAt: prev.playlists.length + 1
          },
          ...prev.playlists
        ]
      };
      saveRecommendationState(next);
      return next;
    });
    void runCloudMutation('create_album', {
      name: baseName,
      description: `${combined.length} tracks saved from queue`,
      initialTrack: combined[0]
    });
    showToast(`${t.queueSavedPlaylist}: ${baseName}`, 'success');
  }, [currentTrack, manualQueue, queue, playbackContext, runCloudMutation, showToast, t.queueSavedPlaylist]);

  const handleAddTrackToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      setRecState((prev) => {
        const next: RecommendationState = {
          ...prev,
          playlists: prev.playlists.map((pl) =>
            pl.id === playlistId && !pl.tracks.some((x) => x.id === track.id)
              ? { ...pl, tracks: [...pl.tracks, track], coverUrl: pl.coverUrl || track.coverUrl }
              : pl
          )
        };
        saveRecommendationState(next);
        return next;
      });
      void runCloudMutation('add_to_album', { albumId: playlistId, track });
    },
    [runCloudMutation]
  );

  const handleRemoveTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      setRecState((prev) => {
        const next: RecommendationState = {
          ...prev,
          playlists: prev.playlists.map((pl) =>
            pl.id === playlistId
              ? { ...pl, tracks: pl.tracks.filter((x) => x.id !== trackId) }
              : pl
          )
        };
        saveRecommendationState(next);
        return next;
      });
      void runCloudMutation('remove_from_album', { albumId: playlistId, trackId });
    },
    [runCloudMutation]
  );

  const handleToggleTrackInAlbum = useCallback(
    (albumId: string, track: Track, currentlyInAlbum: boolean) => {
      if (currentlyInAlbum) {
        handleRemoveTrackFromPlaylist(albumId, track.id);
      } else {
        handleAddTrackToPlaylist(albumId, track);
      }
    },
    [handleAddTrackToPlaylist, handleRemoveTrackFromPlaylist]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      setRecState((prev) => {
        const next: RecommendationState = {
          ...prev,
          playlists: prev.playlists.filter((pl) => pl.id !== playlistId)
        };
        saveRecommendationState(next);
        return next;
      });
      void runCloudMutation('delete_album', { albumId: playlistId });
    },
    [runCloudMutation]
  );

  const handleToggleFollowArtist = useCallback(
    (artistName: string, genre: string) => {
      const cleanName = artistName.trim();
      if (!cleanName) return;
      setFollowedArtists((prev) => {
        const exists = prev.some((a) => a.name.toLowerCase() === cleanName.toLowerCase());
        return exists
          ? prev.filter((a) => a.name.toLowerCase() !== cleanName.toLowerCase())
          : [{ name: cleanName, genre, followedAt: Date.now() }, ...prev];
      });
      void runCloudMutation('toggle_follow_artist', { artistName: cleanName, genre });
    },
    [runCloudMutation]
  );

  const handleUpdateProfile = useCallback(
    (displayName: string, bio: string) => {
      const cleanName = displayName.trim() || listenerProfile.displayName;
      saveListenerDisplayName(cleanName);
      setListenerProfile((prev) => ({
        ...prev,
        displayName: cleanName,
        handle: `@${cleanName.toLowerCase().replace(/[^a-z0-9_]+/g, '') || 'listener'}`,
        bio
      }));
      void runCloudMutation('upsert_profile', { displayName: cleanName, bio });
    },
    [listenerProfile.displayName, runCloudMutation]
  );

  const handleCloneSharedAlbum = useCallback(
    async (shareCode: string): Promise<boolean> => {
      const snap = await cloneSharedAlbumToNeon(shareCode);
      if (snap && snap.connected) {
        applyCloudSnapshot(snap);
        return true;
      }
      return false;
    },
    [applyCloudSnapshot]
  );

  const handleClearHistory = useCallback(() => {
    setPlayHistory([]);
    setRecState((prev) => {
      const next: RecommendationState = { ...prev, recentTracks: [] };
      saveRecommendationState(next);
      return next;
    });
    void runCloudMutation('clear_history', {});
  }, [runCloudMutation]);

  const handleRefreshBlends = useCallback(async () => {
    const rows = await fetchListenerBlends(listenerProfile.listenerId);
    setBlends(rows);
  }, [listenerProfile.listenerId]);

  const handleSaveBlendAsAlbum = useCallback(
    async (name: string, tracksList: Track[]) => {
      const cleanName = name.trim();
      if (!cleanName || tracksList.length === 0) return;

      const createdSnap = await mutateNeonLibrary('create_album', {
        name: cleanName,
        description: 'Curated Music Blend Mix',
        initialTrack: tracksList[0]
      });

      if (createdSnap && createdSnap.connected) {
        const newestAlbum = createdSnap.albums[0];
        let latestSnap: CloudLibrarySnapshot | null = createdSnap;
        if (newestAlbum) {
          for (const extraTrack of tracksList.slice(1, 14)) {
            const updated = await mutateNeonLibrary('add_to_album', {
              albumId: newestAlbum.id,
              track: extraTrack
            });
            if (updated) latestSnap = updated;
          }
        }
        applyCloudSnapshot(latestSnap);
      } else {
        const localId = `alb-${Date.now()}`;
        setRecState((prev) => {
          const next: RecommendationState = {
            ...prev,
            playlists: [
              {
                id: localId,
                name: cleanName,
                description: 'Curated Music Blend Mix',
                coverUrl: tracksList[0]?.coverUrl || '',
                tracks: tracksList.slice(0, 14),
                createdAt: Date.now()
              },
              ...prev.playlists
            ]
          };
          saveRecommendationState(next);
          return next;
        });
      }
      setCurrentTab('favorites');
    },
    [applyCloudSnapshot]
  );

  const hydrateTrackStreamInQueues = useCallback(
    (
      trackId: string,
      resolved: { youtubeId: string; candidateIds: string[]; duration?: number },
      asMusicVideo = false
    ) => {
      if (!trackId || resolved.candidateIds.length === 0) return;
      const patchItem = (item: Track): Track => {
        if (item.id !== trackId) return item;
        const resolvedDuration =
          item.duration >= 60
            ? item.duration
            : resolved.duration && resolved.duration >= 60
              ? resolved.duration
              : item.duration;
        return {
          ...item,
          youtubeId: item.youtubeId || resolved.youtubeId,
          candidateVideoIds:
            item.candidateVideoIds && item.candidateVideoIds.length > 0
              ? item.candidateVideoIds
              : resolved.candidateIds,
          duration: resolvedDuration,
          streamSource: item.audioUrl ? item.streamSource : 'official-stream',
          ...(asMusicVideo
            ? {
                musicVideoId: item.musicVideoId || resolved.youtubeId
              }
            : {})
        };
      };
      queueRef.current = queueRef.current.map(patchItem);
      manualQueueRef.current = manualQueueRef.current.map(patchItem);
      setQueue((prev) => prev.map(patchItem));
      setManualQueue((prev) => prev.map(patchItem));
    },
    []
  );

  const prewarmTrackStream = useCallback(
    (candidate: Track | null | undefined) => {
      if (
        !candidate?.id ||
        candidate.id === currentTrackRef.current.id ||
        candidate.audioUrl ||
        (candidate.candidateVideoIds && candidate.candidateVideoIds.length > 0) ||
        findMasterAudio(candidate.title, candidate.artist)
      ) {
        return;
      }
      const existingCache = peekCachedTrackStream(candidate.title, candidate.artist);
      if (existingCache && existingCache.candidateIds.length > 0) {
        if (preResolvedIdsRef.current.has(candidate.id)) return;
        preResolvedIdsRef.current.add(candidate.id);
        window.setTimeout(() => hydrateTrackStreamInQueues(candidate.id, existingCache), 0);
        return;
      }
      if (preResolvedIdsRef.current.has(candidate.id)) return;
      preResolvedIdsRef.current.add(candidate.id);
      const isVideoActive =
        isStageVisibleRef.current &&
        (stageModeRef.current === 'video-only' || stageModeRef.current === 'video-lyric');
      const fetcher = isVideoActive ? resolveMusicVideoStream : resolveFullTrackStream;
      fetcher(candidate.title, candidate.artist, candidate.duration)
        .then((resolved) => {
          if (!resolved || resolved.candidateIds.length === 0) return;
          hydrateTrackStreamInQueues(candidate.id, resolved, isVideoActive);
        })
        .catch(() => { });
    },
    [hydrateTrackStreamInQueues]
  );

  // Immediately pre-warm the next 3 tracks whenever active track or queue updates for zero-stall background auto-next
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDecision = pickNextTrackPure({
        currentTrack,
        queue,
        manualQueue,
        recentTracks: recState.recentTracks,
        state: recState,
        mood: activeMood
      }).nextTrack;
      prewarmTrackStream(nextDecision);

      const curIdx = queue.findIndex((q) => q.id === currentTrack.id);
      const upcoming = queue.filter(
        (item, idx) =>
          idx > curIdx &&
          item.id !== currentTrack.id &&
          item.id !== nextDecision?.id
      );
      prewarmTrackStream(manualQueue[1] || upcoming[0]);
      prewarmTrackStream(manualQueue[2] || upcoming[1]);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [currentTrack, queue, manualQueue, recState, activeMood, prewarmTrackStream]);

  // Background pre-resolve next upcoming track mid-playback in case queue changed dynamically
  useEffect(() => {
    if (!isPlaying || currentTrack.duration <= 0) return;
    if (currentTime / currentTrack.duration < 0.35) return;

    const preview = pickNextTrackPure({
      currentTrack,
      queue,
      manualQueue,
      recentTracks: recState.recentTracks,
      state: recState,
      mood: activeMood
    }).nextTrack;

    prewarmTrackStream(preview);
  }, [isPlaying, currentTime, currentTrack, queue, manualQueue, recState, activeMood, prewarmTrackStream]);

  // OS Lockscreen / Media Keys integration
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'Sonacast',
        artwork: currentTrack.coverUrl
          ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : []
      });
      ms.setActionHandler('play', () => {
        if (!sharedAudioEngine.getIsPlaying() || sharedAudioEngine.isPlaybackWedged()) {
          handleTogglePlayRef.current();
        }
      });
      ms.setActionHandler('pause', () => sharedAudioEngine.pause());
      ms.setActionHandler('nexttrack', () => handleNextRef.current(false));
      ms.setActionHandler('previoustrack', () => handlePrev());
      ms.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          sharedAudioEngine.seek(details.seekTime);
        }
      });
    } catch {
      // Safe fallback on unsupported browsers
    }
  }, [currentTrack, handlePrev]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = isPlaying ? 'playing' : 'paused';
      if (typeof ms.setPositionState === 'function' && currentTrack.duration > 0) {
        ms.setPositionState({
          duration: Math.max(1, currentTrack.duration),
          playbackRate: recState.playbackRate || 1,
          position: Math.min(Math.max(0, currentTimeRef.current), currentTrack.duration)
        });
      }
    } catch {
      // Safe fallback on unsupported browsers
    }
  }, [isPlaying, currentTrack.id, currentTrack.duration, recState.playbackRate]);

  // Low-CPU 24/7 mode, Android Native Foreground Service bridge, WakeLock & Desktop PiP sync
  useEffect(() => {
    sharedAudioEngine.setLowCpuMode(lowCpuMode);
    try {
      localStorage.setItem('sonacast_low_cpu_mode', String(lowCpuMode));
    } catch {
      // ignore storage quota errors
    }
  }, [lowCpuMode]);

  useEffect(() => {
    let sentinel: { release?: () => Promise<void> } | null = null;
    let released = false;
    const navWithWakeLock = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };

    const requestWakeLock = () => {
      if (released || !isPlaying || lowCpuMode || document.hidden || !navWithWakeLock.wakeLock?.request) {
        return;
      }
      if (sentinel) return;
      navWithWakeLock.wakeLock
        .request('screen')
        .then((s) => {
          if (released) {
            s.release?.().catch(() => { });
          } else {
            sentinel = s;
          }
        })
        .catch(() => { });
    };

    const handleVisibilityWakeLock = () => {
      if (document.visibilityState === 'visible') {
        sentinel = null;
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityWakeLock);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityWakeLock);
      sentinel?.release?.().catch(() => { });
    };
  }, [isPlaying, lowCpuMode]);

  useEffect(() => {
    const win = window as unknown as {
      SonacastAndroid?: {
        syncPlaybackState?: (title: string, artist: string, isPlaying: boolean, lowCpuMode: boolean) => void;
      };
      __sonacastNativeMediaAction?: (action: string) => void;
    };

    win.SonacastAndroid?.syncPlaybackState?.(
      currentTrack.title,
      currentTrack.artist,
      isPlaying,
      lowCpuMode
    );

    win.__sonacastNativeMediaAction = (action: string) => {
      if (action === 'play') {
        if (!sharedAudioEngine.getIsPlaying() || sharedAudioEngine.isPlaybackWedged()) {
          handleTogglePlayRef.current();
        }
      } else if (action === 'pause') {
        sharedAudioEngine.pause();
      } else if (action === 'toggle') {
        handleTogglePlayRef.current();
      } else if (action === 'next') {
        handleNextRef.current(false);
      } else if (action === 'prev') {
        handlePrev();
      }
    };

    const activeLine =
      currentTrack.lyrics.slice().reverse().find((l) => currentTime >= l.time)?.text || '';
    if (pipControllerRef.current?.isOpen()) {
      pipControllerRef.current.update({
        track: currentTrack,
        isPlaying,
        activeLyricText: activeLine,
        lowCpuMode
      });
    }
  }, [currentTrack, isPlaying, lowCpuMode, currentTime, handlePrev]);

  const handleToggleLowCpu = useCallback(() => {
    setLowCpuMode((prev) => !prev);
  }, []);

  const handleOpenDesktopPip = useCallback(async () => {
    if (pipControllerRef.current?.isOpen()) {
      pipControllerRef.current.close();
      pipControllerRef.current = null;
      return;
    }
    const activeLine =
      currentTrackRef.current.lyrics
        .slice()
        .reverse()
        .find((l) => currentTimeRef.current >= l.time)?.text || '';
    const ctrl = await openDesktopPipWindow({
      track: currentTrackRef.current,
      isPlaying: sharedAudioEngine.getIsPlaying(),
      activeLyricText: activeLine,
      lowCpuMode,
      onTogglePlay: () => handleTogglePlayRef.current(),
      onNext: () => handleNextRef.current(false),
      onPrev: () => handlePrev(),
      onClosed: () => {
        pipControllerRef.current = null;
      }
    });
    if (ctrl) {
      pipControllerRef.current = ctrl;
    } else {
      setIsFloatingMinimized(true);
    }
  }, [lowCpuMode, handlePrev]);

  const handleRecordSearch = useCallback(
    (query: string, mode: 'songs' | 'albums' | 'playlists' = 'songs', matchedTrack?: Track) => {
      const cleaned = query.trim();
      if (!cleaned) return;
      const nextList = upsertSearchHistory(searchHistoryRef.current, cleaned, mode, matchedTrack);
      searchHistoryRef.current = nextList;
      saveLocalSearchHistory(nextList);
      setSearchHistory(nextList);

      runCloudMutation('record_search', {
        query: cleaned,
        mode,
        track: matchedTrack || null
      });
    },
    [runCloudMutation]
  );

  const handleDeleteSearchHistory = useCallback(
    (id: string) => {
      const target = searchHistoryRef.current.find((item) => item.id === id);
      const filtered = searchHistoryRef.current.filter((item) => item.id !== id);
      searchHistoryRef.current = filtered;
      saveLocalSearchHistory(filtered);
      setSearchHistory(filtered);
      runCloudMutation('delete_search_item', { id, query: target?.query || '' });
    },
    [runCloudMutation]
  );

  const handleClearSearchHistory = useCallback(() => {
    searchHistoryRef.current = [];
    saveLocalSearchHistory([]);
    setSearchHistory([]);
    runCloudMutation('clear_search_history', {});
  }, [runCloudMutation]);

  // Global keyboard shortcuts (/, Ctrl+K search focus, Space play/pause, Arrows seek/skip, M mute, L like, A album, F favorites, B blend, S shuffle, R repeat, ? help)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentTab((prev) => (prev === 'landing' ? 'discover' : prev));
        window.requestAnimationFrame(() => topSearchInputRef.current?.focus());
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setCurrentTab((prev) => (prev === 'landing' ? 'discover' : prev));
        window.requestAnimationFrame(() => topSearchInputRef.current?.focus());
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (sharedAudioEngine.getIsPlaying()) sharedAudioEngine.pause();
        else sharedAudioEngine.resume();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) handleNextRef.current(false);
        else sharedAudioEngine.seek(sharedAudioEngine.getCurrentTime() + 10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) handlePrev();
        else sharedAudioEngine.seek(Math.max(0, sharedAudioEngine.getCurrentTime() - 10));
      } else if (e.key === 'm' || e.key === 'M') {
        const nextVol = sharedAudioEngine.getVolume() > 0 ? 0 : 0.85;
        setVolume(nextVol);
        sharedAudioEngine.setVolume(nextVol);
      } else if (e.key === 'l' || e.key === 'L') {
        handleToggleLike(currentTrackRef.current);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setAlbumModalTrack(currentTrackRef.current);
      } else if (e.key === 'f' || e.key === 'F') {
        setCurrentTab('favorites');
      } else if (e.key === 'b' || e.key === 'B') {
        setCurrentTab('blend');
      } else if (e.key === 's' || e.key === 'S') {
        handleToggleShuffle();
      } else if (e.key === 'r' || e.key === 'R') {
        handleCycleRepeat();
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrev, handleToggleLike, handleToggleShuffle, handleCycleRepeat]);

  const handleSeek = (secs: number) => {
    sharedAudioEngine.seek(secs);
    setCurrentTime(secs);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    sharedAudioEngine.setVolume(vol);
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === 'pitch') {
      setIsPitchModalOpen(true);
    } else {
      setCurrentTab(tab);
      if (tab === 'visualizer') {
        setIsStageOpen(true);
      } else {
        setIsStageOpen(false);
      }
    }
  };

  const handleSelectStageMode = (mode: StageExperienceMode) => {
    setStageMode(mode);
    setIsStageOpen(true);
    setIsFloatingMinimized(false);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (
      (mode === 'lyrics-only' || mode === 'video-lyric' || mode === 'music-lyric') &&
      currentTrackRef.current.lyrics.length === 0 &&
      lyricsStatus === 'idle'
    ) {
      resolveLyricsForTrack(currentTrackRef.current);
    }
    if (mode === 'video-only' || mode === 'video-lyric') {
      void activateMusicVideoForTrack(currentTrackRef.current);
    }
  };

  const navigateToSearch = (
    query?: string,
    mode: 'songs' | 'albums' | 'playlists' = 'songs',
    selection?: { album?: CatalogAlbum; playlist?: CatalogPlaylist }
  ) => {
    const trimmed = (query || '').trim();
    setExternalSearchMode(mode);
    setExternalSelectedAlbum(selection?.album || null);
    setExternalSelectedPlaylist(selection?.playlist || null);
    if (trimmed) {
      setExternalSearchQuery(trimmed);
      setExternalSearchTrigger((n) => n + 1);
      handleRecordSearch(trimmed, mode);
    } else if (mode !== externalSearchMode || selection?.album || selection?.playlist) {
      setExternalSearchTrigger((n) => n + 1);
    }
    setIsTopSearchFocused(false);
    topSearchInputRef.current?.blur();
    setIsStageOpen(false);
    setCurrentTab('search');
  };

  const handleEnterApp = (targetTab: TabType = 'discover', searchQuery?: string) => {
    if (searchQuery && searchQuery.trim()) {
      navigateToSearch(searchQuery.trim());
      return;
    }
    if (targetTab === 'landing') {
      setCurrentTab('discover');
      return;
    }
    handleTabChange(targetTab);
  };

  const handleTopSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawValue =
      (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.value ?? topSearchInput;
    if (rawValue !== topSearchInput) {
      setTopSearchInput(rawValue);
    }
    const trimmed = rawValue.trim();
    if (trimmed) {
      navigateToSearch(trimmed);
    } else {
      setIsTopSearchFocused(false);
      topSearchInputRef.current?.blur();
      setCurrentTab('search');
    }
  };

  const handleHardRefresh = () => {
    if (typeof window.caches !== 'undefined') {
      window.caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => window.caches.delete(k))))
        .finally(() => {
          window.location.reload();
        });
      return;
    }
    globalThis.location.reload();
  };

  const mobileNavChips: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: t.navLanding, icon: <Home size={13} /> },
    { id: 'music', label: t.navMusic, icon: <Music size={13} /> },
    { id: 'favorites', label: t.navFavorites, icon: <Heart size={13} /> },
    { id: 'blend', label: t.navBlend, icon: <Users size={13} /> },
    { id: 'search', label: t.navSearch, icon: <Search size={13} /> },
    { id: 'radio', label: t.navRadio, icon: <Radio size={13} /> },
    { id: 'podcasts', label: t.navPodcasts, icon: <Mic2 size={13} /> },
    { id: 'visualizer', label: t.navVisualizer, icon: <Sparkles size={13} /> },
  ];

  return (
    <div
      className={
        currentTab === 'landing'
          ? 'min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] font-sans transition-colors'
          : 'flex flex-col h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-sans transition-colors'
      }
    >
      {/* Persistent Official Full-Length Stream Container */}
      <div
        id="sonacast-yt-host"
        ref={ytHostRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '200px',
          height: '200px',
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 25,
          backgroundColor: 'transparent'
        }}
      />

      {currentTab === 'landing' ? (
        <LandingView
          tracks={TRACK_CATALOG}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          lyricsOffset={currentLyricsOffset}
          resolvingTrackId={resolvingTrackId}
          onSelectTrack={handleSelectTrack}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onNext={() => handleNext(false)}
          onEnterApp={handleEnterApp}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          onOpenPitchDeck={() => setIsPitchModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          authUser={authUser}
          likedTrackIds={likedTrackIds}
          onToggleLike={handleToggleLike}
          onOpenAddToAlbum={(tr) => setAlbumModalTrack(tr)}
          onPlayTrackList={handlePlayTrackList}
        />
      ) : (
        <>
          {/* Global Top Bar (Responsive for Mobile + Desktop Web Player) */}
          <header className="bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] px-3 sm:px-6 py-2 flex items-center justify-between gap-2 text-xs z-40 shrink-0 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                data-testid="mobile-menu-open"
                aria-label={t.menuButton}
                className="md:hidden w-10 h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Menu size={18} />
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('landing')}
                className="md:hidden flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-surface)] flex items-center justify-center">
                  <Activity size={15} className="text-[var(--text-primary)]" />
                </div>
                <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                  {t.appName}
                </span>
              </button>

              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] shrink-0" />
                <span className="font-semibold text-[var(--text-primary)] truncate">
                  {currentTrack.title}
                </span>
                <span className="text-[var(--text-dim)] hidden lg:inline">&middot;</span>
                <span className="text-[var(--text-secondary)] truncate hidden lg:inline">
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {!isOnline && (
                <span
                  data-testid="offline-mode-badge"
                  className="text-[10px] font-bold text-amber-500 hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30"
                >
                  <WifiOff size={11} />
                  <span>{t.offlineReadyBadge}</span>
                </span>
              )}
              {sleepMinutesRemaining !== null && (
                <span className="text-[11px] text-[var(--accent-text)] font-mono hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-soft)]">
                  {sleepMinutesRemaining}m
                </span>
              )}

              <button
                type="button"
                onClick={() => setIsMobileQueueOpen(true)}
                aria-label={t.queue}
                title={t.queue}
                className="min-[1380px]:hidden w-9 h-9 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <ListMusic size={15} />
              </button>

              <button
                type="button"
                data-testid="topbar-settings-btn"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
                className="w-9 h-9 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <Settings size={15} />
              </button>

              <button
                type="button"
                data-testid="topbar-auth-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="min-h-[36px] px-2.5 sm:px-3.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-emerald)] text-[var(--text-primary)] text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <User size={13} className="text-[var(--accent-text)] shrink-0" />
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {authUser ? authUser.displayName : t.authSignIn}
                </span>
              </button>
            </div>
          </header>

          {/* Top Application Workspace (flex-1 clips cleanly above shrink-0 BottomPlayerBar) */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left Navigation Sidebar + Mobile Drawer */}
            <Sidebar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              onOpenWallet={() => setIsWalletModalOpen(true)}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              authUser={authUser}
              walletBalanceSol={walletBalanceSol}
              walletCluster={walletCluster}
              isCloudConnected={cloudConnected}
              listenerHandle={listenerProfile.handle}
              likedCount={recState.likedTracks.length}
              playlists={recState.playlists}
              onSelectPlaylist={(pl) => {
                if (pl.tracks.length > 0) {
                  handlePlayTrackList(
                    pl.tracks,
                    false,
                    {
                      id: pl.id,
                      type: 'playlist',
                      title: pl.name,
                      subtitle: `${pl.tracks.length} tracks`,
                      coverUrl: pl.coverUrl || pl.tracks[0]?.coverUrl,
                      ordered: true
                    },
                    0
                  );
                }
                setCurrentTab('favorites');
              }}
              isMobileOpen={isMobileNavOpen}
              onCloseMobile={() => setIsMobileNavOpen(false)}
            />

            {/* Center Column: Fixed Top Search Bar + Scrollable Main Stage & Views */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              {/* Persistent Top Search Bar + Sound History Dropdown + Stage Toggle */}
              <div className="shrink-0 px-4 sm:px-6 pt-4 pb-2 space-y-3 relative z-30">
                <form
                  onSubmit={(e) => {
                    setIsTopSearchFocused(false);
                    handleTopSearchSubmit(e);
                  }}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2 rounded-xl transition-colors"
                  style={{ boxShadow: 'var(--card-shadow)' }}
                >
                  <div className="relative flex-1 min-w-[180px]">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
                    />
                    <input
                      ref={topSearchInputRef}
                      type="text"
                      data-testid="topbar-search-input"
                      value={topSearchInput}
                      onFocus={() => setIsTopSearchFocused(true)}
                      onBlur={() => window.setTimeout(() => setIsTopSearchFocused(false), 160)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsTopSearchFocused(false);
                          e.currentTarget.blur();
                        }
                      }}
                      onChange={(e) => setTopSearchInput(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      aria-label={t.searchPlaceholder}
                      className="w-full pl-9 pr-3 min-h-[38px] py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none min-h-[38px] px-4 py-1.5 rounded-lg bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] hover:opacity-90 font-semibold text-xs transition-opacity flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Search size={14} />
                      <span>{t.searchAction}</span>
                    </button>

                    {currentTab !== 'visualizer' && (
                      <button
                        type="button"
                        onClick={() => setIsStageOpen((prev) => !prev)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 cursor-pointer transition-colors ${isStageOpen
                          ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                      >
                        {t.playerStageToggle}
                      </button>
                    )}
                  </div>
                </form>

                {isTopSearchFocused && (
                  <div
                    data-testid="topbar-search-dropdown"
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute left-0 right-0 md:right-auto md:w-[560px] max-w-[92vw] top-full mt-1.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl p-2.5 space-y-2 z-50 max-h-[68vh] overflow-y-auto"
                  >
                    {topSearchInput.trim().length >= 2 ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-[var(--border-subtle)]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1.5">
                            {isLoadingTopInstant && (
                              <Loader2 size={11} className="animate-spin text-[var(--accent-text)]" />
                            )}
                            <span>{t.instantResults}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigateToSearch(topSearchInput.trim(), 'songs')}
                              className="text-[10px] font-bold text-[var(--accent-text)] hover:underline cursor-pointer"
                            >
                              {t.browseCatalog} &rarr;
                            </button>
                            <button
                              type="button"
                              data-testid="topbar-search-close"
                              aria-label={t.removeSearchItem}
                              onClick={() => {
                                setIsTopSearchFocused(false);
                                topSearchInputRef.current?.blur();
                              }}
                              className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {topInstantResults.tracks.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                              {t.searchSongsTab}
                            </div>
                            {topInstantResults.tracks.map((tr) => (
                              <button
                                key={`top-inst-trk-${tr.id}`}
                                type="button"
                                onClick={() => {
                                  setIsTopSearchFocused(false);
                                  handleRecordSearch(tr.title, 'songs', tr);
                                  handleSelectTrack(tr);
                                }}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                              >
                                <img
                                  src={tr.coverUrl || DEFAULT_COVER_DATA_URI}
                                  alt={tr.title}
                                  onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {tr.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                                    {tr.artist}
                                  </div>
                                </div>
                                <Play size={12} className="text-[var(--accent-text)] shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}

                        {topInstantResults.albums.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                              {t.searchAlbumsTab}
                            </div>
                            {topInstantResults.albums.map((alb) => (
                              <button
                                key={`top-inst-alb-${alb.id}`}
                                type="button"
                                onClick={() => navigateToSearch(alb.title, 'albums', { album: alb })}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                              >
                                <img
                                  src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                                  alt={alb.title}
                                  onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {alb.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                                    {alb.artist}
                                  </div>
                                </div>
                                <Disc3 size={12} className="text-[var(--text-dim)] shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}

                        {topInstantResults.playlists.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                              {t.searchPlaylistsTab}
                            </div>
                            {topInstantResults.playlists.map((pl) => (
                              <button
                                key={`top-inst-pl-${pl.id}`}
                                type="button"
                                onClick={() => navigateToSearch(pl.title, 'playlists', { playlist: pl })}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-elevated)] text-left transition-colors cursor-pointer"
                              >
                                <img
                                  src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                                  alt={pl.title}
                                  onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {pl.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-dim)] truncate">
                                    {pl.creator}
                                    {pl.nbTracks ? ` · ${pl.nbTracks}t` : ''}
                                  </div>
                                </div>
                                <ListMusic size={12} className="text-[var(--text-dim)] shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Quick Jump Search Scope */}
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border-subtle)]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigateToSearch(topSearchInput.trim() || 'Queen', 'songs')}
                              className="h-7 px-2.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Search size={11} />
                              <span>{t.searchSongsTab}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateToSearch(topSearchInput.trim() || 'Queen', 'albums')}
                              className="h-7 px-2.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Disc3 size={11} />
                              <span>{t.searchAlbumsTab}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigateToSearch(topSearchInput.trim() || 'Top Hits', 'playlists')}
                              className="h-7 px-2.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ListMusic size={11} />
                              <span>{t.searchPlaylistsTab}</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            data-testid="topbar-search-close"
                            aria-label={t.removeSearchItem}
                            onClick={() => {
                              setIsTopSearchFocused(false);
                              topSearchInputRef.current?.blur();
                            }}
                            className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        {/* Mood Choices in Search Bar */}
                        <div data-testid="topbar-mood-choices" className="space-y-1">
                          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            {t.moodChoicesLabel}
                          </div>
                          <MoodStrip
                            wrap
                            compact
                            activeMood={activeMood}
                            testIdPrefix="topbar-mood-pill"
                            onSelectMood={(mood) => {
                              const moodQuery = getMoodSearchQuery(mood);
                              void handleSelectMood(mood);
                              navigateToSearch(moodQuery, 'playlists');
                            }}
                          />
                        </div>

                        {/* Top Daily Albums & Top Daily Playlists Side-by-Side */}
                        {(popularCharts.albums.length > 0 || popularCharts.playlists.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {popularCharts.albums.length > 0 && (
                              <div data-testid="topbar-daily-albums" className="space-y-1 min-w-0">
                                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1">
                                  <Disc3 size={11} className="text-[var(--accent-text)]" />
                                  <span>{t.topDailyAlbums}</span>
                                </div>
                                <div className="space-y-1">
                                  {popularCharts.albums.slice(0, 3).map((alb) => (
                                    <button
                                      key={`top-alb-${alb.id}`}
                                      type="button"
                                      data-testid={`topbar-daily-album-${alb.id}`}
                                      onClick={() => navigateToSearch(alb.title, 'albums', { album: alb })}
                                      className="w-full flex items-center gap-2 p-1 rounded-xl bg-[var(--bg-elevated)]/70 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left transition-colors cursor-pointer min-w-0"
                                    >
                                      <img
                                        src={alb.coverUrl || DEFAULT_COVER_DATA_URI}
                                        alt={alb.title}
                                        onError={(e) => applyCoverFallback(e, alb.title, alb.artist)}
                                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                                          {alb.title}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-dim)] truncate">
                                          {alb.artist}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {popularCharts.playlists.length > 0 && (
                              <div data-testid="topbar-daily-playlists" className="space-y-1 min-w-0">
                                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1">
                                  <ListMusic size={11} className="text-[var(--accent-text)]" />
                                  <span>{t.topDailyPlaylists}</span>
                                </div>
                                <div className="space-y-1">
                                  {popularCharts.playlists.slice(0, 3).map((pl) => (
                                    <button
                                      key={`top-pl-${pl.id}`}
                                      type="button"
                                      data-testid={`topbar-daily-playlist-${pl.id}`}
                                      onClick={() => navigateToSearch(pl.title, 'playlists', { playlist: pl })}
                                      className="w-full flex items-center gap-2 p-1 rounded-xl bg-[var(--bg-elevated)]/70 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left transition-colors cursor-pointer min-w-0"
                                    >
                                      <img
                                        src={pl.coverUrl || DEFAULT_COVER_DATA_URI}
                                        alt={pl.title}
                                        onError={(e) => applyCoverFallback(e, pl.title, pl.creator)}
                                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                                          {pl.title}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-dim)] truncate">
                                          {pl.creator}
                                          {pl.nbTracks ? ` · ${pl.nbTracks}t` : ''}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {searchHistory.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-[var(--border-subtle)]">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)] inline-flex items-center gap-1">
                                <Clock size={11} />
                                <span>{t.recentSearches}</span>
                              </span>
                              <button
                                type="button"
                                onClick={handleClearSearchHistory}
                                className="text-[10px] font-semibold text-[var(--text-dim)] hover:text-rose-400 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={10} />
                                <span>{t.clearSearchHistory}</span>
                              </button>
                            </div>
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {searchHistory.slice(0, 6).map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTopSearchInput(item.query);
                                      navigateToSearch(item.query, item.mode);
                                    }}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                  >
                                    <Clock size={11} className="text-[var(--text-dim)] shrink-0" />
                                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                      {item.matchedTrack?.title || item.query}
                                    </span>
                                    {item.matchedTrack?.artist && (
                                      <span className="text-[11px] text-[var(--text-dim)] truncate">
                                        &middot; {item.matchedTrack.artist}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t.removeSearchItem}
                                    onClick={() => handleDeleteSearchHistory(item.id)}
                                    className="p-1 rounded text-[var(--text-dim)] hover:text-rose-400 cursor-pointer shrink-0"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Complete Mobile Horizontal Quick Navigation Strip */}
              <nav
                aria-label="Mobile Quick Navigation"
                className="md:hidden px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 shrink-0"
              >
                {mobileNavChips.map((chip) => {
                  const active = currentTab === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleTabChange(chip.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${active
                        ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                    >
                      {chip.icon}
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </nav>

            <main
              ref={mainScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-2 pb-6 space-y-5 min-w-0 min-h-0"
            >

              {/* Top Stage Player Area: 6 Separated & Optimized Modes */}
              {isStageVisible && (
                <div className="space-y-3" data-testid="stage-container">
                  <div
                    data-testid="stage-mode-bar"
                    className="flex items-start sm:items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)]/85 backdrop-blur-md border border-[var(--border-subtle)]"
                  >
                    <div
                      className="flex flex-wrap sm:inline-flex items-center gap-1 sm:gap-0.5 p-1 sm:p-0.5 rounded-lg bg-[var(--bg-elevated)]/80 min-w-0 flex-1"
                    >
                      {(
                        [
                          { id: 'music-only', label: t.modeMusicOnly, icon: <Disc size={13} /> },
                          { id: 'orbwave-only', label: t.modeOrbwaveOnly, icon: <Activity size={13} /> },
                          { id: 'video-only', label: t.modeVideoOnly, icon: <Video size={13} /> },
                          { id: 'lyrics-only', label: t.modeLyricsOnly, icon: <Mic2 size={13} /> },
                          { id: 'video-lyric', label: t.modeVideoLyric, icon: <Video size={13} /> },
                          { id: 'music-lyric', label: t.modeMusicLyric, icon: <Disc size={13} /> }
                        ] as const
                      ).map((modeOpt) => {
                        const active = stageMode === modeOpt.id;
                        return (
                          <button
                            key={modeOpt.id}
                            type="button"
                            data-stage-mode={modeOpt.id}
                            onClick={() => handleSelectStageMode(modeOpt.id)}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${active
                                ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm ring-1 ring-[var(--accent-border)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)]'
                              }`}
                          >
                            {modeOpt.icon}
                            <span>{modeOpt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      data-testid="stage-close-btn"
                      onClick={() => setIsStageOpen(false)}
                      aria-label={t.closeLabel}
                      title={t.closeLabel}
                      className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tint)] inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 min-h-[260px] sm:min-h-[300px] xl:min-h-[400px]">
                    {stageMode === 'music-only' && (
                      <div className="lg:col-span-12" data-testid="stage-pane-music-only">
                        <VinylCover
                          coverUrl={currentTrack.coverUrl}
                          title={currentTrack.title}
                          artist={currentTrack.artist}
                          album={currentTrack.album}
                          genre={currentTrack.genre}
                          isPlaying={isPlaying}
                          lowCpuMode={lowCpuMode}
                        />
                      </div>
                    )}

                    {stageMode === 'orbwave-only' && (
                      <div className="lg:col-span-12" data-testid="stage-pane-orbwave-only">
                        <OrbwaveCanvas
                          coverUrl={currentTrack.coverUrl}
                          title={currentTrack.title}
                          artist={currentTrack.artist}
                          lyrics={currentTrack.lyrics}
                          currentTime={currentTime}
                          showLyricsOverlay={false}
                          lowCpuMode={lowCpuMode}
                          isPlaying={isPlaying}
                        />
                      </div>
                    )}

                    {stageMode === 'video-only' && (
                      <div
                        className="lg:col-span-12 h-[300px] sm:h-[360px] xl:h-[430px]"
                        data-testid="stage-pane-video-only"
                      >
                        <VideoPlayer
                          track={currentTrack}
                          isPlaying={isPlaying}
                          currentTime={currentTime}
                          hasLiveYouTubeStage={isYouTubeActive}
                          isYtVisualReady={isYtVisualReady}
                          ytStreamError={streamError}
                          isResolvingVideo={resolvingVideoTrackId === currentTrack.id}
                          videoCandidates={currentTrack.musicVideoCandidates || []}
                          activeVideoId={activeYtVideoId || currentTrack.musicVideoId || currentTrack.youtubeId || ''}
                          onSelectVideoCandidate={handleSelectVideoCandidate}
                          onRetryVideo={() => void activateMusicVideoForTrack(currentTrack)}
                          onSwitchToAudioMode={handleSwitchToAudioMaster}
                          onRequestHostFullscreen={handleRequestVideoFullscreen}
                          lowCpuMode={lowCpuMode}
                          videoSlotRef={videoSlotRef}
                        />
                      </div>
                    )}

                    {stageMode === 'lyrics-only' && (
                      <div
                        className="lg:col-span-12 h-[340px] sm:h-[380px] xl:h-[430px]"
                        data-testid="stage-pane-lyrics-only"
                      >
                        <LiveLyrics
                          lyrics={currentTrack.lyrics}
                          currentTime={currentTime}
                          onSeek={handleSeek}
                          title={currentTrack.title}
                          artist={currentTrack.artist}
                          lyricsStatus={lyricsStatus}
                          lyricsSynced={lyricsSynced}
                          lyricsOffset={currentLyricsOffset}
                          trackDuration={currentTrack.duration}
                          onRetryLyrics={handleRetryCurrentLyrics}
                          onOpenLyricCard={handleOpenLyricCard}
                          onOpenArtist={handleOpenArtistSpotlight}
                          fullWidth={true}
                        />
                      </div>
                    )}

                    {stageMode === 'video-lyric' && (
                      <>
                        <div
                          className="lg:col-span-7 h-[280px] sm:h-[340px] xl:h-[400px]"
                          data-testid="stage-pane-video-lyric-video"
                        >
                          <VideoPlayer
                            track={currentTrack}
                            isPlaying={isPlaying}
                            currentTime={currentTime}
                            hasLiveYouTubeStage={isYouTubeActive}
                            isYtVisualReady={isYtVisualReady}
                            ytStreamError={streamError}
                            isResolvingVideo={resolvingVideoTrackId === currentTrack.id}
                            videoCandidates={currentTrack.musicVideoCandidates || []}
                            activeVideoId={activeYtVideoId || currentTrack.musicVideoId || currentTrack.youtubeId || ''}
                            onSelectVideoCandidate={handleSelectVideoCandidate}
                            onRetryVideo={() => void activateMusicVideoForTrack(currentTrack)}
                            onSwitchToAudioMode={handleSwitchToAudioMaster}
                            onRequestHostFullscreen={handleRequestVideoFullscreen}
                            lowCpuMode={lowCpuMode}
                            videoSlotRef={videoSlotRef}
                          />
                        </div>
                        <div
                          className="lg:col-span-5 h-[300px] sm:h-[340px] xl:h-[400px]"
                          data-testid="stage-pane-video-lyric-lyrics"
                        >
                          <LiveLyrics
                            lyrics={currentTrack.lyrics}
                            currentTime={currentTime}
                            onSeek={handleSeek}
                            title={currentTrack.title}
                            artist={currentTrack.artist}
                            lyricsStatus={lyricsStatus}
                            lyricsSynced={lyricsSynced}
                            lyricsOffset={currentLyricsOffset}
                            trackDuration={currentTrack.duration}
                            onRetryLyrics={handleRetryCurrentLyrics}
                            onOpenLyricCard={handleOpenLyricCard}
                            onOpenArtist={handleOpenArtistSpotlight}
                          />
                        </div>
                      </>
                    )}

                    {stageMode === 'music-lyric' && (
                      <>
                        <div className="lg:col-span-7" data-testid="stage-pane-music-lyric-music">
                          <VinylCover
                            coverUrl={currentTrack.coverUrl}
                            title={currentTrack.title}
                            artist={currentTrack.artist}
                            album={currentTrack.album}
                            genre={currentTrack.genre}
                            isPlaying={isPlaying}
                            lowCpuMode={lowCpuMode}
                          />
                        </div>
                        <div
                          className="lg:col-span-5 h-[300px] sm:h-[340px] xl:h-[400px]"
                          data-testid="stage-pane-music-lyric-lyrics"
                        >
                          <LiveLyrics
                            lyrics={currentTrack.lyrics}
                            currentTime={currentTime}
                            onSeek={handleSeek}
                            title={currentTrack.title}
                            artist={currentTrack.artist}
                            lyricsStatus={lyricsStatus}
                            lyricsSynced={lyricsSynced}
                            lyricsOffset={currentLyricsOffset}
                            trackDuration={currentTrack.duration}
                            onRetryLyrics={handleRetryCurrentLyrics}
                            onOpenLyricCard={handleOpenLyricCard}
                            onOpenArtist={handleOpenArtistSpotlight}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Views by Tab */}
              <div className="flex-1 pb-6 min-w-0">
                {currentTab === 'music' && (
                  <MusicView
                    tracks={TRACK_CATALOG}
                    currentTrack={currentTrack}
                    resolvingTrackId={resolvingTrackId}
                    onSelectTrack={handleSelectTrack}
                    onNavigateSearch={navigateToSearch}
                    likedTracks={recState.likedTracks}
                    recentTracks={recState.recentTracks}
                    playlists={recState.playlists}
                    followedArtists={followedArtists}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    onAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onPlayNext={handlePlayNext}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onOpenArtist={handleOpenArtistSpotlight}
                    onPlayTrackList={handlePlayTrackList}
                    onSaveCatalogAlbum={handleSaveCatalogAlbum}
                    activeMood={activeMood}
                    onSelectMood={handleSelectMood}
                  />
                )}

                {currentTab === 'discover' && (
                  <DiscoverView
                    tracks={TRACK_CATALOG}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    resolvingTrackId={resolvingTrackId}
                    onSelectTrack={handleSelectTrack}
                    onTogglePlay={handleTogglePlay}
                    onUploadTrack={handleUploadTrack}
                    onUpdateLyrics={(_trackId, lyrics) => handleUpdateTrackLyrics(lyrics)}
                    onNavigateSearch={navigateToSearch}
                    likedTracks={recState.likedTracks}
                    recentTracks={recState.recentTracks}
                    playlists={recState.playlists}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    onAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onPlayNext={handlePlayNext}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onOpenArtist={handleOpenArtistSpotlight}
                    lowCpuMode={lowCpuMode}
                    onPlayTrackList={handlePlayTrackList}
                    followedArtists={followedArtists}
                    onCreatePlaylist={(name) => handleCreatePlaylist(name)}
                    onAddTrackToPlaylist={handleAddTrackToPlaylist}
                    onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                    onSaveCatalogAlbum={handleSaveCatalogAlbum}
                    activeMood={activeMood}
                    onSelectMood={handleSelectMood}
                    onRecordSearch={handleRecordSearch}
                    onNavigateTab={handleTabChange}
                  />
                )}

                {currentTab === 'vibe' && (
                  <VibeFeedView
                    tracks={queue.length > 0 ? queue : TRACK_CATALOG}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={currentTrack.duration}
                    lyrics={currentTrack.lyrics || []}
                    lyricsSynced={lyricsSynced}
                    lyricsOffset={currentLyricsOffset}
                    isLiked={likedTrackIds.has(currentTrack.id)}
                    isSavedOffline={isTrackSavedOffline(offlineAudioKeys, currentTrack.audioUrl)}
                    canSaveOffline={isCacheableAudioUrl(currentTrack.audioUrl)}
                    vocalReductionEnabled={vocalReductionEnabled}
                    lowCpuMode={lowCpuMode}
                    onSelectTrack={(tr) => handleSelectTrack(tr)}
                    onTogglePlay={handleTogglePlay}
                    onNext={() => handleNext(false)}
                    onPrevious={handlePrev}
                    onSeek={handleSeek}
                    onToggleLike={(id) => {
                      const targetTrack =
                        queue.find((q) => q.id === id) ||
                        TRACK_CATALOG.find((c) => c.id === id) ||
                        currentTrack;
                      handleToggleLike(targetTrack);
                    }}
                    onPlayNext={handlePlayNext}
                    onToggleVocalReduction={handleToggleVocalReduction}
                    onToggleSaveOffline={handleToggleSaveOffline}
                    onShareTrack={handleShareTrack}
                    onOpenLyricCard={handleOpenLyricCard}
                    onOpenArtist={handleOpenArtistSpotlight}
                    onWatchVideo={() => {
                      setCurrentTab('discover');
                      handleSelectStageMode('video-lyric');
                    }}
                  />
                )}

                {currentTab === 'favorites' && (
                  <FavoritesView
                    favorites={favoritesList}
                    albums={recState.playlists}
                    followedArtists={followedArtists}
                    recentTracks={recState.recentTracks}
                    profile={listenerProfile}
                    stats={effectiveStats}
                    isCloudConnected={cloudConnected}
                    currentTrack={currentTrack}
                    onSelectTrack={handleSelectTrack}
                    onPlayTrackList={handlePlayTrackList}
                    onToggleLike={handleToggleLike}
                    onTogglePin={handleTogglePin}
                    onSaveNote={handleSaveFavoriteNote}
                    onOpenAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onCreateAlbum={(name, desc) => handleCreatePlaylist(name, desc)}
                    onDeleteAlbum={handleDeletePlaylist}
                    onRemoveTrackFromAlbum={handleRemoveTrackFromPlaylist}
                    onSaveCatalogAlbum={handleSaveCatalogAlbum}
                    onToggleFollowArtist={handleToggleFollowArtist}
                    onSearchArtist={(name) => handleOpenArtistSpotlight(name)}
                    onUpdateProfile={handleUpdateProfile}
                    onCloneSharedAlbum={handleCloneSharedAlbum}
                    onImportLibrary={handleImportLibrary}
                    onClearHistory={handleClearHistory}
                    onOpenBlend={() => handleTabChange('blend')}
                  />
                )}

                {currentTab === 'blend' && (
                  <BlendView
                    listenerName={listenerProfile.displayName}
                    favorites={favoritesList}
                    recentTracks={recState.recentTracks}
                    catalogTracks={TRACK_CATALOG}
                    blends={blends}
                    initialBlendCode={initialBlendCode}
                    isCloudConnected={cloudConnected}
                    currentTrack={currentTrack}
                    onSelectTrack={handleSelectTrack}
                    onPlayTrackList={handlePlayTrackList}
                    onRefreshBlends={handleRefreshBlends}
                    onSaveBlendAsAlbum={handleSaveBlendAsAlbum}
                    onOpenAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onToggleLike={handleToggleLike}
                    likedTrackIds={likedTrackIds}
                  />
                )}

                {currentTab === 'search' && (
                  <SearchView
                    curatedTracks={TRACK_CATALOG}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    resolvingTrackId={resolvingTrackId}
                    externalQuery={externalSearchQuery}
                    externalMode={externalSearchMode}
                    externalSelectedAlbum={externalSelectedAlbum}
                    externalSelectedPlaylist={externalSelectedPlaylist}
                    externalTrigger={externalSearchTrigger}
                    searchHistory={searchHistory}
                    onRecordSearch={handleRecordSearch}
                    onDeleteSearchHistory={handleDeleteSearchHistory}
                    onClearSearchHistory={handleClearSearchHistory}
                    activeMood={activeMood}
                    onSelectMood={handleSelectMood}
                    onSelectTrack={handleSelectTrack}
                    onTogglePlay={handleTogglePlay}
                    onUpdateLyrics={(lyrics) => handleUpdateTrackLyrics(lyrics, currentTrack.id)}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    onAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onPlayNext={handlePlayNext}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onOpenArtist={handleOpenArtistSpotlight}
                    onPlayTrackList={handlePlayTrackList}
                  />
                )}

                {currentTab === 'radio' && (
                  <RadioView
                    stations={RADIO_STATIONS}
                    onSelectStation={handleSelectRadio}
                    onSearchStations={searchLiveRadioStations}
                    activeStationId={
                      activeRadioStationId ||
                      RADIO_STATIONS.find((s) => s.currentTrack.id === currentTrack.id)?.id
                    }
                  />
                )}

                {currentTab === 'podcasts' && (
                  <PodcastsView
                    podcasts={PODCAST_CATALOG}
                    onSelectPodcast={handleSelectPodcast}
                    onSearchPodcasts={searchPodcastsOnline}
                    activeEpisodeId={currentTrack.id}
                  />
                )}

                {currentTab === 'visualizer' && (
                  <VisualizerStudioView
                    currentTrack={currentTrack}
                    currentTime={currentTime}
                    lowCpuMode={lowCpuMode}
                    isPlaying={isPlaying}
                  />
                )}

                {currentTab === 'proofOfStream' && (
                  <ProofOfStreamView
                    currentTrackTitle={currentTrack.title}
                    currentArtist={currentTrack.artist}
                    isPlaying={isPlaying}
                    listenerId={listenerProfile.listenerId}
                    listenerName={listenerProfile.displayName}
                  />
                )}
              </div>
            </main>
            </div>

            {/* Right Sidebar Queue & Lyrics Panel */}
            <RightSidebar
              queue={queue}
              manualQueue={manualQueue}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              lowCpuMode={lowCpuMode}
              onSelectTrack={(item) => handleSelectTrack(item, { fromContextList: true })}
              onRemoveFromManualQueue={handleRemoveFromManualQueue}
              onClearManualQueue={handleClearManualQueue}
              onMoveManualQueueItem={handleMoveManualQueueItem}
              onRemoveUpcomingTrack={handleRemoveUpcomingTrack}
              onPlayNextFromQueue={handlePlayNext}
              onRefreshRadioMix={handleRefreshRadioMix}
              playbackContext={playbackContext}
              autoplayEnabled={autoplayEnabled}
              onToggleAutoplay={handleToggleAutoplay}
              isShuffled={recState.shuffle}
              onToggleShuffle={handleToggleShuffle}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onSeek={handleSeek}
              currentTime={currentTime}
              radioStations={RADIO_STATIONS}
              onSelectRadio={handleSelectRadio}
              onOpenLyricCard={() => handleOpenLyricCard()}
              ytMonitorRef={ytMonitorRef}
              showYtMonitor={
                isYouTubeActive &&
                isYtVisualReady &&
                !streamError &&
                (!isStageVisible || (stageMode !== 'video-only' && stageMode !== 'video-lyric')) &&
                Boolean(
                  activeYtVideoId &&
                    (currentTrack.musicVideoId === activeYtVideoId ||
                      (currentTrack.musicVideoCandidates || []).some(
                        (c) => c.videoId === activeYtVideoId
                      ))
                )
              }
              onExpandVideoStage={() => handleSelectStageMode('video-lyric')}
              onSaveQueueAsPlaylist={handleSaveQueueAsPlaylist}
              lyricsStatus={lyricsStatus}
              lyricsOffset={currentLyricsOffset}
              onRetryLyrics={handleRetryCurrentLyrics}
              isMobileOpen={isMobileQueueOpen}
              onCloseMobile={() => setIsMobileQueueOpen(false)}
            />
          </div>

          {/* Persistent Bottom Audio Player Bar */}
          <BottomPlayerBar
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isResolvingStream={Boolean(resolvingTrackId)}
            streamError={streamError}
            onTogglePlay={handleTogglePlay}
            onNext={() => handleNext(false)}
            onPrev={handlePrev}
            currentTime={currentTime}
            duration={currentTrack.duration}
            onSeek={handleSeek}
            volume={volume}
            onVolumeChange={handleVolumeChange}
            stageMode={stageMode}
            isStageOpen={isStageVisible}
            onSelectStageMode={handleSelectStageMode}
            onOpenMobileQueue={() => setIsMobileQueueOpen(true)}
            shuffle={recState.shuffle}
            onToggleShuffle={handleToggleShuffle}
            repeatMode={recState.repeatMode}
            onCycleRepeat={handleCycleRepeat}
            isFloatingMinimized={isFloatingMinimized}
            onToggleFloating={() => setIsFloatingMinimized((prev) => !prev)}
            onTriggerDesktopPip={handleOpenDesktopPip}
            isLiked={likedTrackIds.has(currentTrack.id)}
            onToggleLike={() => handleToggleLike(currentTrack)}
            onAddToAlbum={() => setAlbumModalTrack(currentTrack)}
            onStartRadio={() => handleStartRadio(currentTrack)}
            onOpenExpandedPlayer={() => setIsExpandedPlayerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            eqPreset={recState.eqPreset}
            playbackRate={recState.playbackRate}
            crossfadeSeconds={recState.crossfadeSeconds}
            sleepTimerMinutesRemaining={sleepMinutesRemaining}
            onSelectEqPreset={handleSelectEqPreset}
            onSelectPlaybackRate={handleSelectPlaybackRate}
            onSelectCrossfade={handleSelectCrossfade}
            onSetSleepTimer={handleSetSleepTimer}
            onOpenArtist={handleOpenArtistSpotlight}
            onOpenLyricCard={() => handleOpenLyricCard()}
            onSkipSeconds={(delta) =>
              handleSeek(Math.max(0, Math.min(currentTrack.duration || 210, currentTime + delta)))
            }
            normalizationEnabled={normalizationEnabled}
            onToggleNormalization={handleToggleNormalization}
            vocalReductionEnabled={vocalReductionEnabled}
            onToggleVocalReduction={handleToggleVocalReduction}
            canSaveOffline={isCacheableAudioUrl(currentTrack.audioUrl)}
            isSavedOffline={isTrackSavedOffline(offlineAudioKeys, currentTrack.audioUrl)}
            onToggleSaveOffline={() => void handleToggleSaveOffline(currentTrack)}
            onShareTrack={() => void handleShareTrack(currentTrack)}
          />
        </>
      )}

      {isFloatingMinimized && (
        <FloatingMiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          lowCpuMode={lowCpuMode}
          onTogglePlay={handleTogglePlay}
          onNext={() => handleNext(false)}
          onRestoreStage={() => {
            setIsFloatingMinimized(false);
            setIsStageOpen(true);
            if (currentTab === 'landing') setCurrentTab('discover');
          }}
          onCloseFloating={() => setIsFloatingMinimized(false)}
          onOpenDesktopPip={handleOpenDesktopPip}
        />
      )}

      {/* Add to Album / Pin / Note / Artist Follow Sheet */}
      <AddToAlbumModal
        track={albumModalTrack}
        onClose={() => setAlbumModalTrack(null)}
        albums={recState.playlists}
        isLiked={albumModalTrack ? likedTrackIds.has(albumModalTrack.id) : false}
        favoriteMeta={
          albumModalTrack ? favoritesList.find((f) => f.id === albumModalTrack.id) || null : null
        }
        isArtistFollowed={
          albumModalTrack
            ? followedArtists.some((a) => {
              const primary =
                albumModalTrack.artist.split(/,|feat\.?|ft\.?|&/i)[0].trim() ||
                albumModalTrack.artist;
              return a.name.toLowerCase() === primary.toLowerCase();
            })
            : false
        }
        onToggleLike={handleToggleLike}
        onTogglePin={handleTogglePin}
        onSaveNote={handleSaveFavoriteNote}
        onToggleFollowArtist={handleToggleFollowArtist}
        onCreateAlbum={handleCreatePlaylist}
        onToggleTrackInAlbum={handleToggleTrackInAlbum}
        onAddToQueue={handleAddToQueue}
      />

      {/* Spotify-Style Preferences & Audio Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        autoplayEnabled={autoplayEnabled}
        onToggleAutoplay={handleToggleAutoplay}
        normalizationEnabled={normalizationEnabled}
        onToggleNormalization={handleToggleNormalization}
        lowCpuMode={lowCpuMode}
        onToggleLowCpu={handleToggleLowCpu}
        eqPreset={recState.eqPreset}
        onSelectEqPreset={handleSelectEqPreset}
        playbackRate={recState.playbackRate}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        crossfadeSeconds={recState.crossfadeSeconds}
        onSelectCrossfade={handleSelectCrossfade}
        lyricsOffset={currentLyricsOffset}
        onChangeLyricsOffset={handleChangeCurrentLyricsOffset}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onHardRefresh={handleHardRefresh}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onOpenProofOfStream={() => handleTabChange('proofOfStream')}
        onOpenPitchDeck={() => setIsPitchModalOpen(true)}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Full Expanded Now Playing Sheet (Resso / Spotify Style) */}
      <ExpandedPlayerModal
        isOpen={isExpandedPlayerOpen}
        onClose={() => setIsExpandedPlayerOpen(false)}
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={currentTrack.duration}
        isLiked={likedTrackIds.has(currentTrack.id)}
        shuffle={recState.shuffle}
        repeatMode={recState.repeatMode}
        eqPreset={recState.eqPreset}
        playbackRate={recState.playbackRate}
        crossfadeSeconds={recState.crossfadeSeconds}
        sleepTimerMinutesRemaining={sleepMinutesRemaining}
        playlists={recState.playlists}
        lyricsStatus={lyricsStatus}
        lyricsOffset={currentLyricsOffset}
        onRetryLyrics={() => handleRetryCurrentLyrics()}
        onTogglePlay={handleTogglePlay}
        onNext={() => handleNext(false)}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onToggleLike={handleToggleLike}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        autoplayEnabled={autoplayEnabled}
        onToggleAutoplay={handleToggleAutoplay}
        onSelectEqPreset={handleSelectEqPreset}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        onSelectCrossfade={handleSelectCrossfade}
        onSetSleepTimer={handleSetSleepTimer}
        onStartRadio={handleStartRadio}
        onAddToPlaylist={handleAddTrackToPlaylist}
        lowCpuMode={lowCpuMode}
        onOpenArtist={handleOpenArtistSpotlight}
        onOpenLyricCard={handleOpenLyricCard}
        normalizationEnabled={normalizationEnabled}
        onToggleNormalization={handleToggleNormalization}
        vocalReductionEnabled={vocalReductionEnabled}
        onToggleVocalReduction={handleToggleVocalReduction}
        canSaveOffline={isCacheableAudioUrl(currentTrack.audioUrl)}
        isSavedOffline={isTrackSavedOffline(offlineAudioKeys, currentTrack.audioUrl)}
        onToggleSaveOffline={() => void handleToggleSaveOffline(currentTrack)}
        onShareTrack={() => void handleShareTrack(currentTrack)}
        onWatchVideo={() => handleSelectStageMode('video-lyric')}
      />

      {/* Resso / Spotify Style Shareable Lyric Card Studio */}
      <LyricCardModal
        isOpen={lyricCardState.open}
        onClose={() => setLyricCardState({ open: false, lineIndex: null })}
        track={currentTrack}
        initialLineIndex={lyricCardState.lineIndex}
        currentTime={currentTime}
      />

      {/* Spotify / YT Music Artist Spotlight & Follow Drawer */}
      <ArtistSpotlightModal
        artistName={artistSpotlightName}
        genreHint={currentTrack.genre}
        curatedTracks={TRACK_CATALOG}
        currentTrackId={currentTrack.id}
        resolvingTrackId={resolvingTrackId}
        isFollowed={
          artistSpotlightName
            ? followedArtists.some(
                (a) => a.name.toLowerCase() === artistSpotlightName.toLowerCase()
              )
            : false
        }
        likedTrackIds={likedTrackIds}
        onClose={() => setArtistSpotlightName(null)}
        onToggleFollowArtist={handleToggleFollowArtist}
        onSelectTrack={(tr) => handleSelectTrack(tr)}
        onPlayTrackList={handlePlayTrackList}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onStartRadio={handleStartRadio}
        onToggleLike={handleToggleLike}
        onTipArtist={(artist) => {
          setArtistSpotlightName(null);
          setWalletTargetArtist({ artist, trackTitle: `${artist} Studio Support` });
          setIsWalletModalOpen(true);
        }}
      />

      {/* Neon Auth Login / Account Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        authUser={authUser}
        authProviders={authProviders}
        isCloudConnected={cloudConnected}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onOpenLibrary={() => setCurrentTab('favorites')}
      />

      {/* Solana Devnet Wallet Modal */}
      <SolanaWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setWalletTargetArtist(null);
        }}
        activeArtistName={walletTargetArtist?.artist || currentTrack.artist}
        activeArtistAddress={
          walletTargetArtist ? undefined : currentTrack.artistSolanaAddress
        }
        activeTrackTitle={walletTargetArtist?.trackTitle || currentTrack.title}
      />

      {/* Pitch Deck Modal */}
      <PitchDeckModal
        isOpen={isPitchModalOpen}
        onClose={() => setIsPitchModalOpen(false)}
      />

      <ToastBanner
        message={toastState?.message || null}
        tone={toastState?.tone || 'default'}
        onDismiss={() => setToastState(null)}
      />
    </div>
  );
}
