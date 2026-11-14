import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  Track,
  PodcastEpisode,
  RadioStation,
  PlayerMode,
  TabType,
  LyricLine,
  EqPreset,
  MoodPreset,
  RepeatMode
} from './types';
import { TRACK_CATALOG, PODCAST_CATALOG, RADIO_STATIONS } from './data/catalog';
import { ARTISTS_DIRECTORY } from './data/artists800';
import { sharedAudioEngine } from './services/audioEngine';
import { solanaService } from './services/solanaService';
import {
  fetchSyncedLyrics,
  findMasterAudio,
  resolveFullTrackStream,
  searchTracksOnline
} from './services/musicService';
import {
  buildSmartQueueFromPool,
  getMoodSeedQueries,
  getRelatedArtistsFromDirectory,
  loadRecommendationState,
  pickNextTrackPure,
  recordTrackSignal,
  saveRecommendationState,
  type RecommendationState
} from './services/recommendationEngine';
import { useAppPreferences } from './contexts/AppPreferencesContext';

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';
import { ThemeLanguageControls } from './components/layout/ThemeLanguageControls';
import { ExpandedPlayerModal } from './components/player/ExpandedPlayerModal';

import { VinylCover } from './components/player/VinylCover';
import { VideoPlayer } from './components/player/VideoPlayer';
import { OrbwaveCanvas } from './components/visualizer/OrbwaveCanvas';
import { LiveLyrics } from './components/lyrics/LiveLyrics';

import { LandingView } from './components/views/LandingView';
import { DiscoverView } from './components/views/DiscoverView';
import { SearchView } from './components/views/SearchView';
import { RadioView } from './components/views/RadioView';
import { PodcastsView } from './components/views/PodcastsView';
import { VisualizerStudioView } from './components/views/VisualizerStudioView';
import { ProofOfStreamView } from './components/rewards/ProofOfStreamView';

import { SolanaWalletModal } from './components/web3/SolanaWalletModal';
import { PitchDeckModal } from './components/pitch/PitchDeckModal';
import {
  Activity,
  Award,
  Compass,
  Home,
  ListMusic,
  Menu,
  Mic2,
  Presentation,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const { t } = useAppPreferences();
  const [currentTab, setCurrentTab] = useState<TabType>('landing');
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACK_CATALOG[0]);
  const [queue, setQueue] = useState<Track[]>(TRACK_CATALOG);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('orbwave');
  const [isStageOpen, setIsStageOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [walletBalanceSol, setWalletBalanceSol] = useState(0);

  // Top persistent search bar & SearchView handoff
  const [topSearchInput, setTopSearchInput] = useState('');
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalSearchTrigger, setExternalSearchTrigger] = useState(0);

  const [recState, setRecState] = useState<RecommendationState>(() => loadRecommendationState());
  const [manualQueue, setManualQueue] = useState<Track[]>([]);
  const [playHistory, setPlayHistory] = useState<Track[]>([]);
  const [activeMood, setActiveMood] = useState<MoodPreset>('all');
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [sleepEndAtMs, setSleepEndAtMs] = useState<number | null>(null);
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(null);

  const likedTrackIds = useMemo(
    () => new Set(recState.likedTracks.map((tr) => tr.id)),
    [recState.likedTracks]
  );

  // Stream resolution & official backend state
  const [isYouTubeActive, setIsYouTubeActive] = useState(false);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleNextRef = useRef<(fromEnded?: boolean) => void>(() => {});
  const selectionCounterRef = useRef(0);
  const loadedTrackIdRef = useRef<string | null>(null);
  const isRefillingRadioRef = useRef(false);
  const preResolvedIdsRef = useRef<Set<string>>(new Set());

  const currentTrackRef = useRef(currentTrack);
  const currentTimeRef = useRef(currentTime);
  const queueRef = useRef(queue);
  const manualQueueRef = useRef(manualQueue);
  const recStateRef = useRef(recState);
  const activeMoodRef = useRef(activeMood);
  const playHistoryRef = useRef(playHistory);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
    currentTimeRef.current = currentTime;
    queueRef.current = queue;
    manualQueueRef.current = manualQueue;
    recStateRef.current = recState;
    activeMoodRef.current = activeMood;
    playHistoryRef.current = playHistory;
  }, [currentTrack, currentTime, queue, manualQueue, recState, activeMood, playHistory]);

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
    const unsubState = sharedAudioEngine.subscribeStateChange((p) => setIsPlaying(p));
    const unsubEnd = sharedAudioEngine.subscribeTrackEnded(() => {
      handleNextRef.current(true);
    });
    const unsubDur = sharedAudioEngine.subscribeDurationChange((realDur) => {
      setCurrentTrack((prev) => ({ ...prev, duration: realDur }));
    });
    const unsubErr = sharedAudioEngine.subscribeError((msg) => {
      setStreamError(msg);
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

      const target =
        isStageVisible && playerMode === 'video' ? videoSlotRef.current : ytMonitorRef.current;
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
        host.style.borderRadius = playerMode === 'video' ? '1rem' : '0.75rem';
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
  }, [isYouTubeActive, playerMode, currentTab, isLyricsOpen, isStageVisible]);

  // Periodically check Solana devnet balance
  useEffect(() => {
    const checkBal = async () => {
      const bal = await solanaService.fetchBalance();
      setWalletBalanceSol(bal);
    };
    checkBal();
    const interval = setInterval(checkBal, 8000);
    return () => clearInterval(interval);
  }, []);

  const refillRadioQueueIfNeeded = useCallback(async (seedTrack: Track, force = false) => {
    if (isRefillingRadioRef.current) return;
    const currentQ = queueRef.current;
    const idx = currentQ.findIndex((item) => item.id === seedTrack.id);
    const remaining = idx >= 0 ? currentQ.length - 1 - idx : 0;
    if (!force && remaining > 2) return;

    isRefillingRadioRef.current = true;
    try {
      const queries =
        activeMoodRef.current !== 'all'
          ? getMoodSeedQueries(activeMoodRef.current)
          : getRelatedArtistsFromDirectory(seedTrack.artist, seedTrack.genre, 3).map((a) => a.name);

      const batches = await Promise.allSettled(queries.slice(0, 3).map((q) => searchTracksOnline(q)));
      const pooled: Track[] = [];
      for (const b of batches) {
        if (b.status === 'fulfilled' && Array.isArray(b.value)) {
          pooled.push(...b.value);
        }
      }
      if (pooled.length === 0) return;

      setQueue((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const freshCandidates = pooled.filter((c) => c && c.id && !existingIds.has(c.id));
        if (freshCandidates.length === 0) return prev;
        const rankedFresh = buildSmartQueueFromPool(
          seedTrack,
          freshCandidates,
          recStateRef.current.recentTracks,
          recStateRef.current,
          activeMoodRef.current,
          15
        );
        return [...prev, ...rankedFresh].slice(-60);
      });
    } catch {
      // Quiet background radio refill
    } finally {
      isRefillingRadioRef.current = false;
    }
  }, []);

  const handleUpdateTrackLyrics = (lyrics: LyricLine[]) => {
    setCurrentTrack((prev) => ({ ...prev, lyrics }));
  };

  const handleSelectTrack = useCallback(
    async (
      track: Track,
      options?: { skipHistoryPush?: boolean; fromEnded?: boolean }
    ) => {
      const selectionSeq = ++selectionCounterRef.current;
      loadedTrackIdRef.current = track.id;

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

      setQueue((prevQueue) => {
        if (!prevQueue.some((t) => t.id === track.id)) {
          return [track, ...prevQueue];
        }
        return prevQueue;
      });

      refillRadioQueueIfNeeded(track, false);

      if (track.lyrics.length <= 4) {
        fetchSyncedLyrics(track.title, track.artist, track.duration).then((synced) => {
          if (synced && synced.length > 0) {
            setCurrentTrack((prev) => (prev.id === track.id ? { ...prev, lyrics: synced } : prev));
          }
        });
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
          .catch(() => {});
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
      }
    } catch {
      if (selectionSeq !== selectionCounterRef.current) return;
      setResolvingTrackId(null);
      setIsYouTubeActive(false);
      setStreamError('Unable to resolve full-length stream. Try another release.');
      sharedAudioEngine.pause();
    }
  }, [refillRadioQueueIfNeeded]);

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
    handleSelectTrack(podTrack);
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
      artistSolanaAddress: solanaService.getPublicKey(),
      lyrics: [
        { time: 0, text: `Playing local file: ${file.name}` },
        { time: 5, text: 'Loaded with full 60 FPS Web Audio spectrum analysis' },
        { time: 12, text: 'Zero server upload required · 100% Client-Side DSP' }
      ]
    };

    fetchSyncedLyrics(title, artist, 210).then((synced) => {
      if (synced && synced.length > 0) {
        setCurrentTrack((prev) => (prev.id === newTrack.id ? { ...prev, lyrics: synced } : prev));
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
    (fromEnded = false) => {
      if (fromEnded && recStateRef.current.repeatMode === 'one') {
        sharedAudioEngine.seek(0);
        setCurrentTime(0);
        sharedAudioEngine.resume();
        return;
      }

      if (fromEnded && recStateRef.current.repeatMode === 'off') {
        const curIdx = queueRef.current.findIndex((t) => t.id === currentTrackRef.current.id);
        if (curIdx === queueRef.current.length - 1 && manualQueueRef.current.length === 0) {
          // Record completion feedback then stop cleanly at end of queue when Repeat is Off
          setRecState((prev) => recordTrackSignal(prev, currentTrackRef.current, 'complete'));
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

      handleSelectTrack(decision.nextTrack, { fromEnded });
    },
    [handleSelectTrack]
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
      handleSelectTrack(target, { skipHistoryPush: true });
      return;
    }

    const currentIndex = queueRef.current.findIndex((t) => t.id === currentTrackRef.current.id);
    const prevIndex = (currentIndex - 1 + queueRef.current.length) % queueRef.current.length;
    handleSelectTrack(queueRef.current[prevIndex], { skipHistoryPush: true });
  }, [handleSelectTrack]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleToggleLike = useCallback((track: Track) => {
    setRecState((prev) => recordTrackSignal(prev, track, 'toggleLike'));
  }, []);

  const handleAddToQueue = useCallback((track: Track) => {
    setManualQueue((prev) => (prev.some((x) => x.id === track.id) ? prev : [...prev, track]));
  }, []);

  const handleRemoveFromManualQueue = useCallback((index: number) => {
    setManualQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartRadio = useCallback(
    (seedTrack: Track) => {
      const smartNext = buildSmartQueueFromPool(
        seedTrack,
        [...queueRef.current, ...TRACK_CATALOG],
        recStateRef.current.recentTracks,
        recStateRef.current,
        activeMoodRef.current,
        24
      );
      setQueue([seedTrack, ...smartNext]);
      if (seedTrack.id !== currentTrackRef.current.id) {
        handleSelectTrack(seedTrack);
      } else {
        refillRadioQueueIfNeeded(seedTrack, true);
      }
    },
    [handleSelectTrack, refillRadioQueueIfNeeded]
  );

  const handleRefreshRadioMix = useCallback(() => {
    const seed = currentTrackRef.current;
    const smartNext = buildSmartQueueFromPool(
      seed,
      [...queueRef.current, ...TRACK_CATALOG],
      recStateRef.current.recentTracks,
      recStateRef.current,
      activeMoodRef.current,
      24
    );
    setQueue([seed, ...smartNext]);
    refillRadioQueueIfNeeded(seed, true);
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
          handleSelectTrack(seed);
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

  const handlePlayTrackList = useCallback(
    (tracksList: Track[], shouldShuffle = false) => {
      if (tracksList.length === 0) return;
      setRecState((prev) => {
        const next = { ...prev, shuffle: shouldShuffle };
        saveRecommendationState(next);
        return next;
      });
      setQueue(tracksList);
      const firstTrack =
        shouldShuffle && tracksList.length > 1
          ? tracksList[Math.floor(Math.random() * tracksList.length)]
          : tracksList[0];
      handleSelectTrack(firstTrack);
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

  const handleCreatePlaylist = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRecState((prev) => {
      const next: RecommendationState = {
        ...prev,
        playlists: [
          {
            id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: trimmed,
            tracks: [],
            createdAt: Date.now()
          },
          ...prev.playlists
        ]
      };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleAddTrackToPlaylist = useCallback((playlistId: string, track: Track) => {
    setRecState((prev) => {
      const next: RecommendationState = {
        ...prev,
        playlists: prev.playlists.map((pl) =>
          pl.id === playlistId && !pl.tracks.some((x) => x.id === track.id)
            ? { ...pl, tracks: [...pl.tracks, track] }
            : pl
        )
      };
      saveRecommendationState(next);
      return next;
    });
  }, []);

  const handleRemoveTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
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
  }, []);

  const handleDeletePlaylist = useCallback((playlistId: string) => {
    setRecState((prev) => {
      const next: RecommendationState = {
        ...prev,
        playlists: prev.playlists.filter((pl) => pl.id !== playlistId)
      };
      saveRecommendationState(next);
      return next;
    });
  }, []);

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
      resolveFullTrackStream(preview.title, preview.artist, preview.duration).catch(() => {});
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

  // Global keyboard shortcuts (Space play/pause, Arrows seek/skip, M mute, L like)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrev, handleToggleLike]);

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

  const handlePlayerModeChange = (mode: PlayerMode) => {
    setPlayerMode(mode);
    setIsStageOpen(true);
  };

  const handleToggleLyrics = () => {
    setIsLyricsOpen((prev) => {
      const next = !prev;
      if (next) setIsStageOpen(true);
      return next;
    });
  };

  const navigateToSearch = (query?: string) => {
    const trimmed = (query || '').trim();
    if (trimmed) {
      setExternalSearchQuery(trimmed);
      setExternalSearchTrigger((n) => n + 1);
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
          likedTrackIds={likedTrackIds}
          onToggleLike={handleToggleLike}
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

          {/* Top Application Workspace */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left Navigation Sidebar + Mobile Drawer */}
            <Sidebar
              currentTab={currentTab}
              onTabChange={handleTabChange}
              onOpenWallet={() => setIsWalletModalOpen(true)}
              walletBalanceSol={walletBalanceSol}
              isMobileOpen={isMobileNavOpen}
              onCloseMobile={() => setIsMobileNavOpen(false)}
            />

            {/* Center Main Stage */}
            <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-w-0">
              {/* Persistent Top Search Bar + Quick Artist Directory / Stage Toggle */}
              <form
                onSubmit={handleTopSearchSubmit}
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
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                        isStageOpen
                          ? 'bg-[var(--ink-solid)] border-transparent text-[var(--ink-solid-fg)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t.playerStageToggle}
                    </button>
                  )}
                </div>
              </form>

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
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 border transition-colors cursor-pointer ${
                        active
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

              {/* Top Stage Player Area */}
              {isStageVisible && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 min-h-[260px] sm:min-h-[300px] xl:min-h-[400px]">
                  <div
                    className={`transition-all duration-300 ${
                      isLyricsOpen ? 'lg:col-span-7' : 'lg:col-span-12'
                    }`}
                  >
                    {playerMode === 'cover' && (
                      <VinylCover
                        coverUrl={currentTrack.coverUrl}
                        title={currentTrack.title}
                        artist={currentTrack.artist}
                        album={currentTrack.album}
                        genre={currentTrack.genre}
                        isPlaying={isPlaying}
                      />
                    )}

                    {playerMode === 'video' && (
                      <VideoPlayer
                        videoUrl={currentTrack.videoUrl}
                        coverUrl={currentTrack.coverUrl}
                        title={currentTrack.title}
                        artist={currentTrack.artist}
                        isPlaying={isPlaying}
                        isOfficialStreamActive={isYouTubeActive}
                        officialSlotRef={videoSlotRef}
                      />
                    )}

                    {playerMode === 'orbwave' && (
                      <OrbwaveCanvas
                        coverUrl={currentTrack.coverUrl}
                        title={currentTrack.title}
                        artist={currentTrack.artist}
                        lyrics={currentTrack.lyrics}
                        currentTime={currentTime}
                      />
                    )}
                  </div>

                  {isLyricsOpen && (
                    <div className="lg:col-span-5 h-[300px] sm:h-[340px] xl:h-[400px]">
                      <LiveLyrics
                        lyrics={currentTrack.lyrics}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        title={currentTrack.title}
                        artist={currentTrack.artist}
                      />
                    </div>
                  )}
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
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
                    onPlayTrackList={handlePlayTrackList}
                    onCreatePlaylist={handleCreatePlaylist}
                    onAddTrackToPlaylist={handleAddTrackToPlaylist}
                    onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                    activeMood={activeMood}
                    onSelectMood={handleSelectMood}
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
                    onSelectTrack={handleSelectTrack}
                    onTogglePlay={handleTogglePlay}
                    onUpdateLyrics={handleUpdateTrackLyrics}
                    likedTrackIds={likedTrackIds}
                    onToggleLike={handleToggleLike}
                    onAddToQueue={handleAddToQueue}
                    onStartRadio={handleStartRadio}
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
                  />
                )}

                {currentTab === 'proofOfStream' && (
                  <ProofOfStreamView
                    currentTrackTitle={currentTrack.title}
                    currentArtist={currentTrack.artist}
                    isPlaying={isPlaying}
                  />
                )}
              </div>
            </main>

            {/* Right Sidebar Queue, Official Stream Slot & Tipping */}
            <RightSidebar
              queue={queue}
              manualQueue={manualQueue}
              currentTrack={currentTrack}
              onSelectTrack={handleSelectTrack}
              onRemoveFromManualQueue={handleRemoveFromManualQueue}
              onRefreshRadioMix={handleRefreshRadioMix}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLike}
              onSeek={handleSeek}
              currentTime={currentTime}
              radioStations={RADIO_STATIONS}
              onSelectRadio={handleSelectRadio}
              onOpenTipModal={() => setIsWalletModalOpen(true)}
              ytMonitorRef={ytMonitorRef}
              showYtMonitor={isYouTubeActive && (!isStageVisible || playerMode !== 'video')}
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
            playerMode={playerMode}
            onPlayerModeChange={handlePlayerModeChange}
            isLyricsOpen={isLyricsOpen}
            onToggleLyrics={handleToggleLyrics}
            onOpenMobileQueue={() => setIsMobileQueueOpen(true)}
            shuffle={recState.shuffle}
            onToggleShuffle={handleToggleShuffle}
            repeatMode={recState.repeatMode}
            onCycleRepeat={handleCycleRepeat}
            isLiked={likedTrackIds.has(currentTrack.id)}
            onToggleLike={() => handleToggleLike(currentTrack)}
            onStartRadio={() => handleStartRadio(currentTrack)}
            onOpenExpandedPlayer={() => setIsExpandedPlayerOpen(true)}
          />
        </>
      )}

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
