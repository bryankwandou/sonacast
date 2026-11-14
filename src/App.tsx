import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Track,
  PodcastEpisode,
  RadioStation,
  PlayerMode,
  TabType,
  Language,
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

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';

import { VinylCover } from './components/player/VinylCover';
import { VideoPlayer } from './components/player/VideoPlayer';
import { OrbwaveCanvas } from './components/visualizer/OrbwaveCanvas';
import { LiveLyrics } from './components/lyrics/LiveLyrics';

import { DiscoverView } from './components/views/DiscoverView';
import { SearchView } from './components/views/SearchView';
import { RadioView } from './components/views/RadioView';
import { PodcastsView } from './components/views/PodcastsView';
import { VisualizerStudioView } from './components/views/VisualizerStudioView';
import { ProofOfStreamView } from './components/rewards/ProofOfStreamView';

import { SolanaWalletModal } from './components/web3/SolanaWalletModal';
import { PitchDeckModal } from './components/pitch/PitchDeckModal';
import { Globe, RefreshCw, Search } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('discover');
  const [currentTrack, setCurrentTrack] = useState<Track>(TRACK_CATALOG[0]);
  const [queue, setQueue] = useState<Track[]>(TRACK_CATALOG);
  const [playerMode, setPlayerMode] = useState<PlayerMode>('orbwave');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

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

      const target = playerMode === 'video' ? videoSlotRef.current : ytMonitorRef.current;
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
  }, [isYouTubeActive, playerMode, currentTab, isLyricsOpen]);

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
    }
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
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06080E] text-white overflow-hidden font-sans">
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

      {/* Global Top Ticker Bar */}
      <div className="bg-[#0A0E1A] border-b border-[#1A2234] px-6 py-1.5 flex items-center justify-between text-xs z-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-bold text-white tracking-wide shrink-0">
            85,000,000+ GLOBAL MUSIC RELEASES ONLINE
          </span>
          <span className="text-gray-500 hidden sm:inline">·</span>
          <span className="text-gray-300 truncate hidden md:inline">
            Queen, Michael Jackson, The Weeknd, Eminem, Taylor Swift & {ARTISTS_DIRECTORY.length} Artists Indexed
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-emerald-400 font-mono hidden lg:flex items-center gap-1">
            <Globe size={11} />
            100% Full-Length Catalog & LRCLIB Sync
          </span>
          <button
            onClick={handleHardRefresh}
            className="px-2 py-0.5 rounded bg-[#161F2E] border border-[#233148] text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            title="Reload Latest Version"
          >
            <RefreshCw size={11} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Top Application Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          language={language}
          onLanguageChange={setLanguage}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          walletBalanceSol={walletBalanceSol}
        />

        {/* Center Main Stage */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
          {/* Persistent Top Search Bar + Explicit Search Button */}
          <form
            onSubmit={handleTopSearchSubmit}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 bg-[#0A0F1A] border border-[#1B2336] p-2.5 rounded-2xl shadow-lg"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={topSearchInput}
                onChange={(e) => setTopSearchInput(e.target.value)}
                placeholder="Search 85,000,000+ songs or 800+ artists (Queen, Eminem, Taylor Swift, Dewa 19)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#111726] border border-[#222D45] text-xs text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Search size={14} />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('search')}
              className="px-3.5 py-2 rounded-xl bg-[#12192A] hover:bg-[#192338] border border-[#24324D] text-emerald-300 font-semibold text-xs shrink-0 cursor-pointer transition-colors"
            >
              {ARTISTS_DIRECTORY.length} Artists Menu
            </button>
          </form>

          {/* Top Stage Player Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[460px]">
            <div className={`transition-all duration-300 ${isLyricsOpen ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
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
              <div className="lg:col-span-5 h-[460px]">
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

          {/* Sub-Views by Tab */}
          <div className="flex-1 pb-6">
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
          showYtMonitor={isYouTubeActive && playerMode !== 'video'}
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
        onPlayerModeChange={setPlayerMode}
        isLyricsOpen={isLyricsOpen}
        onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)}
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
