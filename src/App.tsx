import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  BlendRoom,
  CloudLibrarySnapshot,
  Track,
  PodcastEpisode,
  RadioStation,
  StageExperienceMode,
  SearchHistoryEntry,
  TabType,
  LyricLine,
  EqPreset,
  MoodPreset,
  RepeatMode,
  FavoriteTrack,
  FollowedArtist,
  ListenerProfile,
  ListeningStats,
  PlaybackContextInfo,
  AuthUser,
  AuthProvidersMeta
} from './types';
import { TRACK_CATALOG, PODCAST_CATALOG, RADIO_STATIONS } from './data/catalog';
import { ARTISTS_DIRECTORY } from './data/artists800';
import { sharedAudioEngine } from './services/audioEngine';
import { solanaService } from './services/solanaService';
import {
  fetchLyricsWithMeta,
  findMasterAudio,
  resolveFullTrackStream,
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
  getMoodSeedQueries,
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

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';
import { ThemeLanguageControls } from './components/layout/ThemeLanguageControls';
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

import { LandingView } from './components/views/LandingView';
import { DiscoverView } from './components/views/DiscoverView';
import { FavoritesView } from './components/views/FavoritesView';
import { BlendView } from './components/views/BlendView';
import { SearchView } from './components/views/SearchView';
import { RadioView } from './components/views/RadioView';
import { PodcastsView } from './components/views/PodcastsView';
import { VisualizerStudioView } from './components/views/VisualizerStudioView';
import { ProofOfStreamView } from './components/rewards/ProofOfStreamView';

import { AddToAlbumModal } from './components/modals/AddToAlbumModal';
import { AuthModal } from './components/auth/AuthModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { SolanaWalletModal } from './components/web3/SolanaWalletModal';
import { PitchDeckModal } from './components/pitch/PitchDeckModal';
import {
  Activity,
  Award,
  Clock,
  Compass,
  Disc,
  Heart,
  Home,
  Keyboard,
  ListMusic,
  Menu,
  Mic2,
  Minimize2,
  PictureInPicture2,
  Presentation,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  User,
  Users,
  Video,
  X,
  Zap
} from 'lucide-react';

export default function App() {
  const { t } = useAppPreferences();
  const [currentTab, setCurrentTab] = useState<TabType>('landing');
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACK_CATALOG[0]);
  const [queue, setQueue] = useState<Track[]>(TRACK_CATALOG);
  const [stageMode, setStageMode] = useState<StageExperienceMode>('orbwave-only');
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');
  const [lyricsSource, setLyricsSource] = useState<string>('');
  const [lyricsSynced, setLyricsSynced] = useState<boolean>(false);

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
  const [externalSearchTrigger, setExternalSearchTrigger] = useState(0);

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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [initialBlendCode, setInitialBlendCode] = useState<string | null>(null);

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
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleNextRef = useRef<(fromEnded?: boolean) => void>(() => { });
  const selectionCounterRef = useRef(0);
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
    };

    hydrateCloud();
    return () => {
      cancelled = true;
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
    });
    const unsubErr = sharedAudioEngine.subscribeError((msg) => {
      setStreamError(msg);
      const now = Date.now();
      if (
        autoplayEnabledRef.current &&
        playbackContextRef.current.type === 'radio' &&
        autoRetryCountRef.current < 2 &&
        now - lastErrAutoSkipAtRef.current > 2500
      ) {
        lastErrAutoSkipAtRef.current = now;
        autoRetryCountRef.current += 1;
        window.setTimeout(() => handleNextRef.current(true), 450);
      }
    });

    return () => {
      unsubTime();
      unsubState();
      unsubEnd();
      unsubDur();
      unsubErr();
    };
  }, []);

  const isStageVisible = isStageOpen || currentTab === 'visualizer';

  // Synchronize fixed overlay #sonacast-yt-host bounds with active slot (Video stage or RightSidebar monitor)
  useEffect(() => {
    const syncPosition = () => {
      const host = ytHostRef.current;
      if (!host) return;

      if (!isYouTubeActive) {
        host.style.left = '-9999px';
        host.style.top = '-9999px';
        host.style.width = '1px';
        host.style.height = '1px';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        return;
      }

      const isVideoStage = stageMode === 'video-only' || stageMode === 'video-lyric';
      const target = isStageVisible && isVideoStage ? videoSlotRef.current : ytMonitorRef.current;
      if (!target) {
        host.style.left = '-9999px';
        host.style.top = '-9999px';
        host.style.width = '200px';
        host.style.height = '200px';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        return;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width >= 180 && rect.height >= 180) {
        host.style.left = `${rect.left}px`;
        host.style.top = `${rect.top}px`;
        host.style.width = `${rect.width}px`;
        host.style.height = `${rect.height}px`;
        host.style.opacity = '1';
        host.style.pointerEvents = 'auto';
        host.style.borderRadius = isVideoStage ? '1rem' : '0.75rem';
      } else {
        host.style.left = '-9999px';
        host.style.top = '-9999px';
        host.style.width = '200px';
        host.style.height = '200px';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
      }
    };

    syncPosition();

    const ro = new ResizeObserver(syncPosition);
    if (videoSlotRef.current) ro.observe(videoSlotRef.current);
    if (ytMonitorRef.current) ro.observe(ytMonitorRef.current);

    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [isYouTubeActive, stageMode, currentTab, isStageVisible]);

  // Periodically check active Solana cluster balance & sync wallet switches
  useEffect(() => {
    const checkBal = async () => {
      setWalletCluster(solanaService.getCluster());
      const bal = await solanaService.fetchBalance();
      setWalletBalanceSol(bal);
    };
    checkBal();
    const unsub = solanaService.subscribe(() => {
      setWalletCluster(solanaService.getCluster());
      setWalletBalanceSol(solanaService.getCachedBalance());
    });
    const interval = setInterval(checkBal, 12000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

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
    if (!force && remaining > 2) return;

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
      if (pooled.length === 0) return;

      const seedTier = classifyTrackTier(seedTrack);
      const sameOrCompatible = pooled.filter((c) => {
        const ct = classifyTrackTier(c);
        return (
          ct.classId === seedTier.classId ||
          seedTier.compatibleClasses.includes(ct.classId)
        );
      });
      const candidatePool = sameOrCompatible.length >= 4 ? sameOrCompatible : pooled;

      setQueue((prev) => {
        const activeId = currentTrackRef.current.id;
        const activeIdx = prev.findIndex((p) => p.id === activeId);
        // When force-refreshing for an auto-similar class switch, replace unplayed disparate tail cleanly
        const preservedHead =
          force && activeIdx >= 0 ? prev.slice(0, activeIdx + 1) : prev;
        const headIds = new Set(preservedHead.map((p) => p.id));
        const freshCandidates = candidatePool.filter((c) => c && c.id && !headIds.has(c.id));
        if (freshCandidates.length === 0) return prev;
        const rankedFresh = buildSmartQueueFromPool(
          seedTrack,
          freshCandidates,
          recStateRef.current.recentTracks,
          recStateRef.current,
          activeMoodRef.current,
          20
        );
        const merged = [...preservedHead, ...rankedFresh].slice(-50);
        queueRef.current = merged;
        return merged;
      });
    } catch {
      // Quiet background radio refill
    } finally {
      isRefillingRadioRef.current = false;
    }
  }, []);

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
      opts?: { customTitle?: string; customArtist?: string; forceRefresh?: boolean }
    ) => {
      setLyricsStatus('loading');
      setLyricsSource('');
      try {
        const res = await fetchLyricsWithMeta(
          opts?.customTitle || targetTrack.title,
          opts?.customArtist || targetTrack.artist,
          targetTrack.duration,
          targetTrack.album,
          opts?.forceRefresh
        );
        if (currentTrackRef.current.id !== targetTrack.id) return;
        if (res.lyrics.length > 0) {
          setLyricsSynced(res.synced);
          setLyricsSource(res.source);
          setLyricsStatus('loaded');
          setCurrentTrack((prev) =>
            prev.id === targetTrack.id ? { ...prev, lyrics: res.lyrics } : prev
          );
          setQueue((prevQ) =>
            prevQ.map((item) => (item.id === targetTrack.id ? { ...item, lyrics: res.lyrics } : item))
          );
        } else {
          setLyricsSynced(false);
          setLyricsSource('');
          setLyricsStatus('unavailable');
        }
      } catch {
        if (currentTrackRef.current.id === targetTrack.id) {
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

  // Hydrate initial track lyrics quietly if initial catalog entry has sparse/no lines
  useEffect(() => {
    if (currentTrackRef.current.lyrics.length <= 2) {
      resolveLyricsForTrack(currentTrackRef.current);
    }
  }, [resolveLyricsForTrack]);

  const handleSelectTrack = useCallback(
    async (
      track: Track,
      options?: { skipHistoryPush?: boolean; fromEnded?: boolean; fromContextList?: boolean }
    ) => {
      const selectionSeq = ++selectionCounterRef.current;
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

      mutateNeonLibrary('record_play', { track }).then((snap) => {
        if (snap && snap.connected) {
          setCloudConnected(true);
          setCloudStats(snap.stats);
        }
      });

      const isSingleStandalonePlay = !options?.fromContextList && autoplayEnabledRef.current;

      if (isSingleStandalonePlay) {
        const autoCtx = buildAutoSimilarContext(track);
        playbackContextRef.current = autoCtx;
        setPlaybackContext(autoCtx);

        const seedTier = classifyTrackTier(track);
        const instantPool = gatherLocalCandidatePool(track.id);
        const classMatchedInstant = instantPool.filter((cand) => {
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
        if (ctxType === 'radio') {
          refillRadioQueueIfNeeded(track, false);
        } else if (autoplayEnabledRef.current && recStateRef.current.repeatMode !== 'one') {
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

      if (track.lyrics.length <= 2) {
        resolveLyricsForTrack(track);
      } else {
        setLyricsStatus('loaded');
        setLyricsSynced(track.lyrics.length > 4);
        setLyricsSource('catalog');
      }

      // Silently pre-fetch lyrics for next track in queue so Up Next starts instantaneously
      const qAfter = queueRef.current;
      const curIdxInQ = qAfter.findIndex((item) => item.id === track.id);
      const nextPreviewTrack = curIdxInQ >= 0 ? qAfter[curIdxInQ + 1] : qAfter[0];
      if (nextPreviewTrack && nextPreviewTrack.id !== track.id && nextPreviewTrack.lyrics.length <= 2) {
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
          .catch(() => {});
      }

      // 1. Direct Studio Master MP3 or local user file
      if (track.audioUrl) {
        setResolvingTrackId(null);
        setIsYouTubeActive(false);
        sharedAudioEngine.playTrack(track.duration, track.bpm, track.audioUrl);
        return;
      }

      // 2. Check bundled master fallback by exact title + artist
      const masterMatch = findMasterAudio(track.title, track.artist);
      if (masterMatch) {
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
        sharedAudioEngine.playTrack(updatedTrack.duration, updatedTrack.bpm, updatedTrack.audioUrl);
        return;
      }

      // 3. Pre-resolved candidate YouTube official stream IDs
      const existingIds =
        track.candidateVideoIds && track.candidateVideoIds.length > 0
          ? track.candidateVideoIds
          : track.youtubeId
            ? [track.youtubeId]
            : [];

      if (existingIds.length > 0) {
        setResolvingTrackId(null);
        setIsYouTubeActive(true);
        sharedAudioEngine.playYouTubeTrack(existingIds, track.duration, track.bpm);
        if (existingIds.length < 4) {
          const activeGen = sharedAudioEngine.getPlayGeneration();
          resolveFullTrackStream(track.title, track.artist, track.duration)
            .then((resolved) => {
              if (!resolved || selectionSeq !== selectionCounterRef.current) return;
              sharedAudioEngine.appendCandidateIds(resolved.candidateIds, activeGen);
            })
            .catch(() => { });
        }
        return;
      }

      // 4. Resolve 100% full-length official stream dynamically for 85M+ catalog search items
      sharedAudioEngine.pause();
      setResolvingTrackId(track.id);
      setIsYouTubeActive(true);
      try {
        const resolved = await resolveFullTrackStream(track.title, track.artist, track.duration);
        if (selectionSeq !== selectionCounterRef.current) return;

        setResolvingTrackId(null);

        if (resolved && resolved.candidateIds.length > 0) {
          const updatedTrack: Track = {
            ...track,
            youtubeId: resolved.youtubeId,
            candidateVideoIds: resolved.candidateIds,
            duration: resolved.duration,
            streamSource: 'official-stream'
          };
          setCurrentTrack((prev) => (prev.id === track.id ? updatedTrack : prev));
          setQueue((prevQ) => prevQ.map((t) => (t.id === track.id ? updatedTrack : t)));
          sharedAudioEngine.playYouTubeTrack(resolved.candidateIds, resolved.duration, track.bpm);
        } else {
          setIsYouTubeActive(false);
          setStreamError('Full official stream unavailable for this release. Try another track.');
          sharedAudioEngine.pause();
          if (options?.fromEnded && autoplayEnabledRef.current && autoRetryCountRef.current < 3) {
            autoRetryCountRef.current += 1;
            window.setTimeout(() => handleNextRef.current(true), 350);
          }
        }
      } catch {
        if (selectionSeq !== selectionCounterRef.current) return;
        setResolvingTrackId(null);
        setIsYouTubeActive(false);
        setStreamError('Unable to resolve full-length stream. Try another release.');
        sharedAudioEngine.pause();
        if (options?.fromEnded && autoplayEnabledRef.current && autoRetryCountRef.current < 3) {
          autoRetryCountRef.current += 1;
          window.setTimeout(() => handleNextRef.current(true), 350);
        }
      }
    }, [buildAutoSimilarContext, gatherLocalCandidatePool, refillRadioQueueIfNeeded, resolveLyricsForTrack]);

  const handleSelectRadio = (station: RadioStation) => {
    handleSelectTrack(station.currentTrack);
  };

  const handleSelectPodcast = (episode: PodcastEpisode) => {
    const podTrack: Track = {
      id: episode.id,
      title: episode.title,
      artist: episode.host,
      album: episode.podcastName,
      duration: episode.duration,
      coverUrl: episode.coverUrl,
      videoUrl: episode.videoUrl,
      genre: 'Podcast',
      lyrics: episode.transcript,
      artistSolanaAddress: episode.hostSolanaAddress,
      bpm: 90
    };
    handleSelectTrack(podTrack, { fromContextList: true });
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
      videoUrl:
        'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
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

  const handleTogglePlay = () => {
    if (isPlaying) {
      sharedAudioEngine.pause();
      return;
    }

    if (
      sharedAudioEngine.getActiveBackend() !== 'none' &&
      loadedTrackIdRef.current === currentTrack.id &&
      currentTime < currentTrack.duration
    ) {
      sharedAudioEngine.resume();
    } else {
      handleSelectTrack(currentTrack);
    }
  };

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
          if (autoplayEnabledRef.current) {
            const seed = currentTrackRef.current;
            const autoCtx = buildAutoSimilarContext(seed);
            playbackContextRef.current = autoCtx;
            setPlaybackContext(autoCtx);

            const seedTier = classifyTrackTier(seed);
            let pool = gatherLocalCandidatePool(seed.id).filter((cand) => {
              const ct = classifyTrackTier(cand);
              return (
                ct.classId === seedTier.classId ||
                seedTier.compatibleClasses.includes(ct.classId)
              );
            });

            if (pool.length === 0) {
              try {
                const liveQueries = getClassMatchedSeedQueries(seed, activeMoodRef.current, 3);
                const liveBatches = await Promise.allSettled(
                  liveQueries.map((q) => searchTracksOnline(q))
                );
                const fetched: Track[] = [];
                for (const b of liveBatches) {
                  if (b.status === 'fulfilled' && Array.isArray(b.value)) {
                    for (const item of b.value) {
                      if (item && item.id && item.id !== seed.id) {
                        discoveredPoolRef.current.set(item.id, item);
                        fetched.push(item);
                      }
                    }
                  }
                }
                pool = fetched;
              } catch {
                // Fall back to full local pool below
              }
            }

            if (pool.length === 0) {
              pool = gatherLocalCandidatePool(seed.id);
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
            const additions = rankedPool.filter((t) => !existingIds.has(t.id));
            const nextAuto = additions[0] || rankedPool.find((t) => t.id !== seed.id);
            if (nextAuto) {
              const extendedQueue = [...queueRef.current, ...additions];
              queueRef.current = extendedQueue;
              setQueue(extendedQueue);
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
  }, []);

  const handleRemoveFromManualQueue = useCallback((index: number) => {
    setManualQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartRadio = useCallback(
    (seedTrack: Track) => {
      const radioCtx: PlaybackContextInfo = {
        id: `radio-${seedTrack.id}`,
        type: 'radio',
        title: `Radio · ${seedTrack.title}`,
        subtitle: seedTrack.artist,
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

  const handleSetSleepTimer = useCallback((minutes: number | null) => {
    if (minutes === null) {
      setSleepEndAtMs(null);
      setSleepMinutesRemaining(null);
    } else {
      setSleepEndAtMs(Date.now() + minutes * 60000);
      setSleepMinutesRemaining(minutes);
    }
  }, []);

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

  // Background pre-resolve next upcoming track into module cache
  useEffect(() => {
    if (!isPlaying || currentTrack.duration <= 0) return;
    if (currentTime < 15 || currentTime / currentTrack.duration < 0.45) return;

    const preview = pickNextTrackPure({
      currentTrack,
      queue,
      manualQueue,
      recentTracks: recState.recentTracks,
      state: recState,
      mood: activeMood
    }).nextTrack;

    if (
      preview &&
      preview.id !== currentTrack.id &&
      !preview.audioUrl &&
      !preResolvedIdsRef.current.has(preview.id)
    ) {
      preResolvedIdsRef.current.add(preview.id);
      resolveFullTrackStream(preview.title, preview.artist, preview.duration).catch(() => { });
    }
  }, [isPlaying, currentTime, currentTrack, queue, manualQueue, recState, activeMood]);

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
      ms.setActionHandler('play', () => sharedAudioEngine.resume());
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
    if (isPlaying && !lowCpuMode && !document.hidden && navWithWakeLock.wakeLock?.request) {
      navWithWakeLock.wakeLock
        .request('screen')
        .then((s) => {
          if (released) {
            s.release?.().catch(() => {});
          } else {
            sentinel = s;
          }
        })
        .catch(() => {});
    }
    return () => {
      released = true;
      sentinel?.release?.().catch(() => {});
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
      if (action === 'play') sharedAudioEngine.resume();
      else if (action === 'pause') sharedAudioEngine.pause();
      else if (action === 'toggle') {
        if (sharedAudioEngine.getIsPlaying()) sharedAudioEngine.pause();
        else sharedAudioEngine.resume();
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
      onTogglePlay: () => {
        if (sharedAudioEngine.getIsPlaying()) sharedAudioEngine.pause();
        else sharedAudioEngine.resume();
      },
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
    (query: string, mode: 'songs' | 'albums' = 'songs', matchedTrack?: Track) => {
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

  // Global keyboard shortcuts (Space play/pause, Arrows seek/skip, M mute, L like, A album, F favorites, B blend, S shuffle, R repeat, ? help)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      if (e.code === 'Space') {
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
      } else if (tab === 'landing') {
        setIsStageOpen(false);
      }
    }
  };

  const handleSelectStageMode = (mode: StageExperienceMode) => {
    setStageMode(mode);
    setIsStageOpen(true);
    setIsFloatingMinimized(false);
    if (
      (mode === 'lyrics-only' || mode === 'video-lyric' || mode === 'music-lyric') &&
      currentTrackRef.current.lyrics.length === 0 &&
      lyricsStatus === 'idle'
    ) {
      resolveLyricsForTrack(currentTrackRef.current);
    }
  };

  const navigateToSearch = (query?: string) => {
    const trimmed = (query || '').trim();
    if (trimmed) {
      setExternalSearchQuery(trimmed);
      setExternalSearchTrigger((n) => n + 1);
      handleRecordSearch(trimmed, 'songs');
    }
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
    { id: 'landing', label: t.navLanding, icon: <Home size={13} /> },
    { id: 'discover', label: t.navDiscover, icon: <Compass size={13} /> },
    { id: 'favorites', label: t.navFavorites, icon: <Heart size={13} /> },
    { id: 'blend', label: t.navBlend, icon: <Users size={13} /> },
    { id: 'search', label: t.navSearch, icon: <Search size={13} /> },
    { id: 'radio', label: t.navRadio, icon: <Radio size={13} /> },
    { id: 'podcasts', label: t.navPodcasts, icon: <Mic2 size={13} /> },
    { id: 'visualizer', label: t.navVisualizer, icon: <Sparkles size={13} /> },
    { id: 'proofOfStream', label: t.navProofOfStream, icon: <Award size={13} /> },
    { id: 'pitch', label: t.navPitchDeck, icon: <Presentation size={13} /> },
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
          backgroundColor: '#000000'
        }}
      />

      {currentTab === 'landing' ? (
        <LandingView
          tracks={TRACK_CATALOG}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
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

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {sleepMinutesRemaining !== null && (
                <span className="text-[11px] text-[var(--accent-text)] font-mono hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-soft)]">
                  {sleepMinutesRemaining}m
                </span>
              )}

              <ThemeLanguageControls variant="topbar" />

              <button
                type="button"
                data-testid="topbar-auth-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="min-h-[36px] px-2.5 sm:px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-emerald)] text-[var(--text-primary)] text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <User size={13} className="text-[var(--accent-text)] shrink-0" />
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {authUser ? authUser.displayName : t.authSignIn}
                </span>
              </button>

              <button
                type="button"
                data-testid="shortcuts-open-btn"
                onClick={() => setIsShortcutsOpen(true)}
                aria-label={t.keyboardShortcutsLabel}
                title={t.keyboardShortcutsLabel}
                className="hidden sm:flex w-9 h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] items-center justify-center shrink-0 cursor-pointer"
              >
                <Keyboard size={15} />
              </button>

              <button
                type="button"
                onClick={() => setIsMobileQueueOpen(true)}
                aria-label={t.queue}
                className="min-[1380px]:hidden w-9 h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <ListMusic size={15} />
              </button>

              <button
                type="button"
                onClick={handleHardRefresh}
                className="hidden sm:flex min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] items-center gap-1 transition-colors cursor-pointer"
                title={t.reloadLabel}
              >
                <RefreshCw size={12} />
                <span className="hidden lg:inline">{t.reloadLabel}</span>
              </button>
            </div>
          </header>

          {/* Top Application Workspace (reserves space above fixed BottomPlayerBar) */}
          <div className="flex flex-1 overflow-hidden min-h-0 pb-20 sm:pb-24">
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
              isMobileOpen={isMobileNavOpen}
              onCloseMobile={() => setIsMobileNavOpen(false)}
            />

            {/* Center Main Stage */}
            <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-w-0">
              {/* Persistent Top Search Bar + Sound History Dropdown + Stage Toggle */}
              <div className="relative z-30">
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
                      type="text"
                      value={topSearchInput}
                      onFocus={() => setIsTopSearchFocused(true)}
                      onBlur={() => window.setTimeout(() => setIsTopSearchFocused(false), 160)}
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

                    <button
                      type="button"
                      onClick={() => handleTabChange('search')}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium text-xs shrink-0 cursor-pointer transition-colors"
                    >
                      {ARTISTS_DIRECTORY.length} Artists
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

                {isTopSearchFocused && searchHistory.length > 0 && (
                  <div
                    data-testid="topbar-search-dropdown"
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] shadow-2xl p-2.5 space-y-1.5 z-50"
                  >
                    <div className="flex items-center justify-between px-1.5 pb-1 border-b border-[var(--border-subtle)]">
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
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {searchHistory.slice(0, 8).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsTopSearchFocused(false);
                              setTopSearchInput(item.query);
                              navigateToSearch(item.query);
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <Clock size={12} className="text-[var(--text-dim)] shrink-0" />
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
              </div>

              {/* Complete Mobile Horizontal Quick Navigation Strip */}
              <nav
                aria-label="Mobile Quick Navigation"
                className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mt-1 shrink-0"
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

              {/* Top Stage Player Area: 6 Separated & Optimized Modes */}
              {isStageVisible && (
                <div className="space-y-3" data-testid="stage-container">
                  <div
                    data-testid="stage-mode-bar"
                    className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
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
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border ${
                              active
                                ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                                : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {modeOpt.icon}
                            <span>{modeOpt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="stage-low-cpu-btn"
                        onClick={handleToggleLowCpu}
                        aria-pressed={lowCpuMode}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 border cursor-pointer transition-colors ${
                          lowCpuMode
                            ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Zap size={12} />
                        <span>{t.lowCpuShort}</span>
                      </button>

                      <button
                        type="button"
                        data-testid="stage-minimize-btn"
                        onClick={() => {
                          setIsFloatingMinimized(true);
                          setIsStageOpen(false);
                        }}
                        title={t.minimizeFloating}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                      >
                        <Minimize2 size={12} />
                        <span className="hidden sm:inline">{t.minimizeFloating}</span>
                      </button>

                      <button
                        type="button"
                        data-testid="stage-pip-btn"
                        onClick={handleOpenDesktopPip}
                        title={t.desktopPip}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                      >
                        <PictureInPicture2 size={12} />
                        <span className="hidden sm:inline">{t.desktopPip}</span>
                      </button>
                    </div>
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
                      <div className="lg:col-span-12" data-testid="stage-pane-video-only">
                        <VideoPlayer
                          videoUrl={currentTrack.videoUrl}
                          coverUrl={currentTrack.coverUrl}
                          title={currentTrack.title}
                          artist={currentTrack.artist}
                          isPlaying={isPlaying}
                          isOfficialStreamActive={isYouTubeActive}
                          officialSlotRef={videoSlotRef}
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
                          lyricsSource={lyricsSource}
                          lyricsSynced={lyricsSynced}
                          onRetryLyrics={handleRetryCurrentLyrics}
                          fullWidth={true}
                        />
                      </div>
                    )}

                    {stageMode === 'video-lyric' && (
                      <>
                        <div className="lg:col-span-7" data-testid="stage-pane-video-lyric-video">
                          <VideoPlayer
                            videoUrl={currentTrack.videoUrl}
                            coverUrl={currentTrack.coverUrl}
                            title={currentTrack.title}
                            artist={currentTrack.artist}
                            isPlaying={isPlaying}
                            isOfficialStreamActive={isYouTubeActive}
                            officialSlotRef={videoSlotRef}
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
                            lyricsSource={lyricsSource}
                            lyricsSynced={lyricsSynced}
                            onRetryLyrics={handleRetryCurrentLyrics}
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
                            lyricsSource={lyricsSource}
                            lyricsSynced={lyricsSynced}
                            onRetryLyrics={handleRetryCurrentLyrics}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Views by Tab */}
              <div className="flex-1 pb-6 min-w-0">
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
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onPlayTrackList={handlePlayTrackList}
                    followedArtists={followedArtists}
                    onCreatePlaylist={(name) => handleCreatePlaylist(name)}
                    onAddTrackToPlaylist={handleAddTrackToPlaylist}
                    onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                    activeMood={activeMood}
                    onSelectMood={handleSelectMood}
                    onRecordSearch={handleRecordSearch}
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
                    onToggleFollowArtist={handleToggleFollowArtist}
                    onSearchArtist={(name) => navigateToSearch(name)}
                    onUpdateProfile={handleUpdateProfile}
                    onCloneSharedAlbum={handleCloneSharedAlbum}
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
                    externalTrigger={externalSearchTrigger}
                    searchHistory={searchHistory}
                    onRecordSearch={handleRecordSearch}
                    onDeleteSearchHistory={handleDeleteSearchHistory}
                    onClearSearchHistory={handleClearSearchHistory}
                    onSelectTrack={handleSelectTrack}
                    onTogglePlay={handleTogglePlay}
                    onUpdateLyrics={(lyrics) => handleUpdateTrackLyrics(lyrics, currentTrack.id)}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    onAddToAlbum={(tr) => setAlbumModalTrack(tr)}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onPlayTrackList={handlePlayTrackList}
                  />
                )}

                {currentTab === 'radio' && (
                  <RadioView
                    stations={RADIO_STATIONS}
                    onSelectStation={handleSelectRadio}
                    activeStationId={RADIO_STATIONS.find((s) => s.currentTrack.id === currentTrack.id)?.id}
                  />
                )}

                {currentTab === 'podcasts' && (
                  <PodcastsView
                    podcasts={PODCAST_CATALOG}
                    onSelectPodcast={handleSelectPodcast}
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

            {/* Right Sidebar Queue, Official Stream Slot & Tipping */}
            <RightSidebar
              queue={queue}
              manualQueue={manualQueue}
              currentTrack={currentTrack}
              onSelectTrack={(item) => handleSelectTrack(item, { fromContextList: true })}
              onRemoveFromManualQueue={handleRemoveFromManualQueue}
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
              onOpenTipModal={() => setIsWalletModalOpen(true)}
              ytMonitorRef={ytMonitorRef}
              showYtMonitor={
                isYouTubeActive &&
                (!isStageVisible || (stageMode !== 'video-only' && stageMode !== 'video-lyric'))
              }
              lyricsStatus={lyricsStatus}
              lyricsSource={lyricsSource}
              lyricsSynced={lyricsSynced}
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
            autoplayEnabled={autoplayEnabled}
            onToggleAutoplay={handleToggleAutoplay}
            lowCpuMode={lowCpuMode}
            onToggleLowCpu={handleToggleLowCpu}
            isFloatingMinimized={isFloatingMinimized}
            onToggleFloating={() => setIsFloatingMinimized((prev) => !prev)}
            onTriggerDesktopPip={handleOpenDesktopPip}
            isLiked={likedTrackIds.has(currentTrack.id)}
            onToggleLike={() => handleToggleLike(currentTrack)}
            onAddToAlbum={() => setAlbumModalTrack(currentTrack)}
            onStartRadio={() => handleStartRadio(currentTrack)}
            onOpenExpandedPlayer={() => setIsExpandedPlayerOpen(true)}
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
        lyricsSource={lyricsSource}
        onRetryLyrics={() => handleRetryCurrentLyrics()}
        onTogglePlay={handleTogglePlay}
        onNext={() => handleNext(false)}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onToggleLike={handleToggleLike}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSelectEqPreset={handleSelectEqPreset}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        onSelectCrossfade={handleSelectCrossfade}
        onSetSleepTimer={handleSetSleepTimer}
        onStartRadio={handleStartRadio}
        onAddToPlaylist={handleAddTrackToPlaylist}
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
        onClose={() => setIsWalletModalOpen(false)}
        activeArtistName={currentTrack.artist}
        activeArtistAddress={currentTrack.artistSolanaAddress}
        activeTrackTitle={currentTrack.title}
      />

      {/* Pitch Deck Modal */}
      <PitchDeckModal
        isOpen={isPitchModalOpen}
        onClose={() => setIsPitchModalOpen(false)}
      />
    </div>
  );
}
