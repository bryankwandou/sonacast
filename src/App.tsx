import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Track,
  PodcastEpisode,
  RadioStation,
  PlayerMode,
  TabType,
  LyricLine
} from './types';
import { TRACK_CATALOG, PODCAST_CATALOG, RADIO_STATIONS } from './data/catalog';
import { ARTISTS_DIRECTORY } from './data/artists800';
import { sharedAudioEngine } from './services/audioEngine';
import { solanaService } from './services/solanaService';
import {
  fetchSyncedLyrics,
  findMasterAudio,
  resolveFullTrackStream
} from './services/musicService';
import { useAppPreferences } from './contexts/AppPreferencesContext';

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';
import { ThemeLanguageControls } from './components/layout/ThemeLanguageControls';

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
  Globe,
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

  // Stream resolution & official backend state
  const [isYouTubeActive, setIsYouTubeActive] = useState(false);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleNextRef = useRef<() => void>(() => {});
  const selectionCounterRef = useRef(0);
  const loadedTrackIdRef = useRef<string | null>(null);

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
      handleNextRef.current();
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

  const handleUpdateTrackLyrics = (lyrics: LyricLine[]) => {
    setCurrentTrack((prev) => ({ ...prev, lyrics }));
  };

  const handleSelectTrack = useCallback(async (track: Track) => {
    const selectionSeq = ++selectionCounterRef.current;
    loadedTrackIdRef.current = track.id;

    setStreamError(null);
    setCurrentTrack(track);
    setCurrentTime(0);

    setQueue((prevQueue) => {
      if (!prevQueue.some((t) => t.id === track.id)) {
        return [track, ...prevQueue];
      }
      return prevQueue;
    });

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
  }, []);

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

  const handleNext = useCallback(() => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    handleSelectTrack(queue[nextIndex]);
  }, [queue, currentTrack.id, handleSelectTrack]);

  const handlePrev = useCallback(() => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    handleSelectTrack(queue[prevIndex]);
  }, [queue, currentTrack.id, handleSelectTrack]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

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
    <div className="flex flex-col h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-sans transition-colors">
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

      {/* Global Top Bar (Responsive for Mobile + Desktop) */}
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--accent-emerald)] to-[var(--accent-cyan)] p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-[var(--bg-sidebar)] rounded-[6px] flex items-center justify-center">
                <Activity size={15} className="text-[var(--accent-text)]" />
              </div>
            </div>
            <span className="text-sm font-black tracking-tight text-[var(--text-primary)]">
              {t.appName}
            </span>
          </button>

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)] animate-pulse shrink-0" />
            <span className="font-bold text-[var(--text-primary)] tracking-wide shrink-0">
              {t.topTickerTitle}
            </span>
            <span className="text-[var(--text-dim)] hidden lg:inline">&middot;</span>
            <span className="text-[var(--text-secondary)] truncate hidden lg:inline">
              Queen, Michael Jackson, The Weeknd, Eminem &amp; {ARTISTS_DIRECTORY.length} Artists
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <span className="text-[11px] text-[var(--accent-text)] font-mono hidden min-[1380px]:flex items-center gap-1 mr-1">
            <Globe size={11} />
            100% Full-Length &amp; LRCLIB
          </span>

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
            className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-2.5 rounded-2xl transition-colors"
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
                className="w-full pl-9 pr-3 min-h-[40px] py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-emerald)] transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="submit"
                className="flex-1 sm:flex-none min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-hover)] text-[var(--accent-fg)] font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Search size={14} />
                <span>{t.searchAction}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('search')}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--accent-text)] font-semibold text-xs shrink-0 cursor-pointer transition-colors"
              >
                {ARTISTS_DIRECTORY.length} Artists
              </button>

              {currentTab !== 'visualizer' && (
                <button
                  type="button"
                  onClick={() => setIsStageOpen((prev) => !prev)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    isStageOpen
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
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
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
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
            {currentTab === 'landing' && (
              <LandingView
                tracks={TRACK_CATALOG}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                resolvingTrackId={resolvingTrackId}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onNavigateTab={handleTabChange}
                onOpenPitchDeck={() => setIsPitchModalOpen(true)}
                onOpenStage={() => setIsStageOpen((prev) => !prev)}
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
                onUpdateLyrics={handleUpdateTrackLyrics}
                onNavigateSearch={navigateToSearch}
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
          currentTrack={currentTrack}
          onSelectTrack={handleSelectTrack}
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
        onNext={handleNext}
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
