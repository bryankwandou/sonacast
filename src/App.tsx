import { useState, useEffect } from 'react';
import type { Track, PodcastEpisode, RadioStation, PlayerMode, TabType, Language } from './types';
import { TRACK_CATALOG, PODCAST_CATALOG, RADIO_STATIONS } from './data/catalog';
import { sharedAudioEngine } from './services/audioEngine';
import { solanaService } from './services/solanaService';
import { fetchSyncedLyrics } from './services/musicService';

import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomPlayerBar } from './components/layout/BottomPlayerBar';

import { VinylCover } from './components/player/VinylCover';
import { VideoPlayer } from './components/player/VideoPlayer';
import { OrbwaveCanvas } from './components/visualizer/OrbwaveCanvas';
import { LiveLyrics } from './components/lyrics/LiveLyrics';

import { DiscoverView } from './components/views/DiscoverView';
import { RadioView } from './components/views/RadioView';
import { PodcastsView } from './components/views/PodcastsView';
import { VisualizerStudioView } from './components/views/VisualizerStudioView';
import { ProofOfStreamView } from './components/rewards/ProofOfStreamView';

import { SolanaWalletModal } from './components/web3/SolanaWalletModal';
import { PitchDeckModal } from './components/pitch/PitchDeckModal';

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

  // Sync with audio engine
  useEffect(() => {
    const unsubTime = sharedAudioEngine.subscribeTimeUpdate((t) => setCurrentTime(t));
    const unsubState = sharedAudioEngine.subscribeStateChange((p) => setIsPlaying(p));
    return () => {
      unsubTime();
      unsubState();
    };
  }, []);

  // Update wallet balance periodically
  useEffect(() => {
    const checkBal = async () => {
      const bal = await solanaService.fetchBalance();
      setWalletBalanceSol(bal);
    };
    checkBal();
    const interval = setInterval(checkBal, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTrack = (track: Track) => {
    setCurrentTrack(track);
    setCurrentTime(0);

    // Add to queue if not present
    if (!queue.some((t) => t.id === track.id)) {
      setQueue([track, ...queue]);
    }

    sharedAudioEngine.playTrack(track.duration, track.bpm, track.audioUrl);
  };

  const handleSelectRadio = (station: RadioStation) => {
    setCurrentTrack(station.currentTrack);
    setCurrentTime(0);
    sharedAudioEngine.playTrack(
      station.currentTrack.duration,
      station.currentTrack.bpm,
      station.currentTrack.audioUrl
    );
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
      duration: 180,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
      audioUrl: objectUrl,
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-screens-with-changing-colors-41618-large.mp4',
      genre: 'Custom Audio',
      bpm: 120,
      artistSolanaAddress: solanaService.getPublicKey(),
      lyrics: [
        { time: 0, text: `Playing custom file: ${file.name}` },
        { time: 5, text: `Loaded locally with full 60 FPS spectrum analysis` },
        { time: 12, text: `Zero server upload required · 100% Client-Side DSP` }
      ]
    };

    // Try fetching lyrics online for this song name
    fetchSyncedLyrics(title, artist, 180).then((synced) => {
      if (synced && synced.length > 0) {
        newTrack.lyrics = synced;
        setCurrentTrack({ ...newTrack, lyrics: synced });
      }
    });

    handleSelectTrack(newTrack);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      sharedAudioEngine.pause();
    } else {
      sharedAudioEngine.playTrack(currentTrack.duration, currentTrack.bpm, currentTrack.audioUrl);
    }
  };

  const handleNext = () => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    handleSelectTrack(queue[nextIndex]);
  };

  const handlePrev = () => {
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    handleSelectTrack(queue[prevIndex]);
  };

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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06080E] text-white overflow-hidden font-sans">
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
        <main className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Top Stage Player Area (Shows when in Library or Studio) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[460px]">
            {/* Primary Visual Stage (Cover / Video / Orbwave) */}
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

            {/* Side-by-Side Synchronized Live Lyrics Panel */}
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
                tracks={queue}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onUploadTrack={handleUploadTrack}
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

        {/* Right Sidebar Queue & Tipping */}
        <RightSidebar
          queue={queue}
          currentTrack={currentTrack}
          onSelectTrack={handleSelectTrack}
          radioStations={RADIO_STATIONS}
          onSelectRadio={handleSelectRadio}
          onOpenTipModal={() => setIsWalletModalOpen(true)}
        />
      </div>

      {/* Persistent Bottom Audio Player Bar */}
      <BottomPlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
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

      {/* Silicon Valley Pitch Deck Modal */}
      <PitchDeckModal
        isOpen={isPitchModalOpen}
        onClose={() => setIsPitchModalOpen(false)}
      />
    </div>
  );
}
