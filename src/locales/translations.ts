import type { Language } from '../types';

export interface TranslationKeys {
  appName: string;
  tagline: string;
  brandSubtitle: string;
  navLanding: string;
  navMusic: string;
  navDiscover: string;
  navSearch: string;
  navRadio: string;
  navPodcasts: string;
  navVisualizer: string;
  navProofOfStream: string;
  navPitchDeck: string;
  modeCover: string;
  modeVideo: string;
  modeOrbwave: string;
  nowPlaying: string;
  liveRadio: string;
  activePodcasts: string;
  tipArtist: string;
  directTipTitle: string;
  connectWallet: string;
  manageWallet: string;
  lyrics: string;
  queue: string;
  upNextCount: string;
  volume: string;
  listeners: string;
  searchPlaceholder: string;
  searchAction: string;
  audioQuality: string;
  claimRewards: string;
  themeLabel: string;
  themeDark: string;
  themeLight: string;
  languageLabel: string;
  menuButton: string;
  closeLabel: string;
  reloadLabel: string;
  topTickerTitle: string;
  heroBadge: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroCatalogCta: string;
  heroPitchCta: string;
  landingHighlightsTitle: string;
  pillar1Title: string;
  pillar1Desc: string;
  pillar2Title: string;
  pillar2Desc: string;
  pillar3Title: string;
  pillar3Desc: string;
  pillar4Title: string;
  pillar4Desc: string;
  featuredMastersHeading: string;
  chartsHeading: string;
  chartsGlobal: string;
  chartsIndonesia: string;
  viewFullLibrary: string;
  tuneIn: string;
  playEpisode: string;
  uploadLocal: string;
  playerStageToggle: string;
  quickPicks: string;
  moodAll: string;
  moodFocus: string;
  moodChill: string;
  moodUpbeat: string;
  moodWorkout: string;
  moodIndonesian: string;
  moodClassic: string;
  moodAcoustic: string;
  moodLateNight: string;
  moodParty: string;
  moodRomance: string;
  moodSleep: string;
  likedSongs: string;
  recentlyPlayed: string;
  playlists: string;
  createPlaylist: string;
  playNext: string;
  addToQueue: string;
  startRadio: string;
  refreshMix: string;
  browseCatalog: string;
  popularArtists: string;
  upNext: string;
  artistTip: string;
  nowPlayingSheet: string;
  equalizer: string;
  playbackSpeed: string;
  sleepTimer: string;
  crossfade: string;
  exportLyricCard: string;
  radioAutoMix: string;
  openFullPlayer: string;
  shuffleLabel: string;
  repeatLabel: string;
  enterPlayerCta: string;
  editorialEyebrow: string;
  editorialHeroLead: string;
  editorialHeroHighlight: string;
  editorialDeck: string;
  previewTrackLabel: string;
  tryInPlayer: string;
  footerExplore: string;
  footerProtocol: string;
  footerTagline: string;
  navFavorites: string;
  navBlend: string;
  addToAlbum: string;
  createAlbum: string;
  albumNamePlaceholder: string;
  albumDescPlaceholder: string;
  personalNotePlaceholder: string;
  pinTrack: string;
  musicBlendHeading: string;
  musicBlendDesc: string;
  createBlendBtn: string;
  joinBlendLabel: string;
  followedArtistsLabel: string;
  listeningStatsLabel: string;
  keyboardShortcutsLabel: string;
  cloudSyncedLabel: string;
  importSharedAlbum: string;
  madeForYou: string;
  featuredAlbums: string;
  searchSongsTab: string;
  searchAlbumsTab: string;
  searchPlaylistsTab: string;
  searchLyricsTab: string;
  songCreditsLabel: string;
  topDailyAlbums: string;
  watchMusicVideo: string;
  musicVideoBadge: string;
  switchVideoVersion: string;
  findingMusicVideo: string;
  videoUnavailable: string;
  audioMasterMode: string;
  saveQueuePlaylist: string;
  queueSavedPlaylist: string;
  jumpBackIn: string;
  expandVideoStage: string;
  topDailyPlaylists: string;
  moodChoicesLabel: string;
  instantResults: string;
  playingFrom: string;
  queuedByYou: string;
  autoplaySimilar: string;
  autoNextShort: string;
  similarClassLabel: string;
  playAlbum: string;
  playOrdered: string;
  switchToRadio: string;
  authSignIn: string;
  authSignUp: string;
  authSignOut: string;
  authAccountLabel: string;
  authEmailLabel: string;
  authPasswordLabel: string;
  authNameLabel: string;
  authGoogleCta: string;
  authGoogleComingSoon: string;
  authGoogleDesc: string;
  modeMusicOnly: string;
  modeOrbwaveOnly: string;
  modeVideoOnly: string;
  modeLyricsOnly: string;
  modeVideoLyric: string;
  modeMusicLyric: string;
  recentSearches: string;
  clearSearchHistory: string;
  removeSearchItem: string;
  lyricsLoading: string;
  lyricsUnavailable: string;
  lyricsRetry: string;
  lyricsSearchPlaceholder: string;
  lyricsSyncedLabel: string;
  lyricsTimedLabel: string;
  lowCpuMode: string;
  lowCpuShort: string;
  minimizeFloating: string;
  desktopPip: string;
  downloadApk: string;
  clearQueue: string;
  moveUp: string;
  soundAndSleep: string;
  lyricCardStudio: string;
  copyQuote: string;
  downloadPng: string;
  selectLyricLinesHint: string;
  artistProfileLabel: string;
  followArtist: string;
  followingArtist: string;
  artistTopTracks: string;
  artistAlbums: string;
  playArtistTopMix: string;
  sleepOff: string;
  navVibeFeed: string;
  navGroupDiscover: string;
  navGroupLibrary: string;
  navGroupExperience: string;
  normalizeVolume: string;
  karaokeMode: string;
  saveOffline: string;
  savedOffline: string;
  shareTrackLink: string;
  resyncLyrics: string;
  skipBack15: string;
  skipForward15: string;
  offlineReadyBadge: string;
  filterBelowPlaceholder: string;
  syncOffsetLabel: string;
  syncTooLate: string;
  syncTooEarly: string;
  syncSnapLine: string;
  syncSnapArmedHint: string;
  syncReset: string;
  copyLine: string;
  copiedLabel: string;
  exportLibrary: string;
  importLibrary: string;
}

export interface LanguageOption {
  code: Language;
  label: string;
  shortCode: string;
  dir?: 'ltr' | 'rtl';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', shortCode: 'EN' },
  { code: 'id', label: 'Bahasa Indonesia', shortCode: 'ID' },
  { code: 'ms', label: 'Bahasa Melayu', shortCode: 'MS' },
  { code: 'jv', label: 'Basa Jawa', shortCode: 'JV' },
  { code: 'su', label: 'Basa Sunda', shortCode: 'SU' },
  { code: 'ja', label: '日本語 (Japanese)', shortCode: 'JA' },
  { code: 'ko', label: '한국어 (Korean)', shortCode: 'KO' },
  { code: 'zh', label: '中文 (简体)', shortCode: 'ZH' },
  { code: 'zh-TW', label: '繁體中文', shortCode: 'TW' },
  { code: 'es', label: 'Español', shortCode: 'ES' },
  { code: 'fr', label: 'Français', shortCode: 'FR' },
  { code: 'de', label: 'Deutsch', shortCode: 'DE' },
  { code: 'pt', label: 'Português', shortCode: 'PT' },
  { code: 'it', label: 'Italiano', shortCode: 'IT' },
  { code: 'nl', label: 'Nederlands', shortCode: 'NL' },
  { code: 'ru', label: 'Русский', shortCode: 'RU' },
  { code: 'ar', label: 'العربية (Arabic)', shortCode: 'AR', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी (Hindi)', shortCode: 'HI' },
  { code: 'th', label: 'ภาษาไทย (Thai)', shortCode: 'TH' },
  { code: 'vi', label: 'Tiếng Việt', shortCode: 'VI' },
  { code: 'tl', label: 'Filipino / Tagalog', shortCode: 'TL' },
  { code: 'tr', label: 'Türkçe', shortCode: 'TR' },
  { code: 'pl', label: 'Polski', shortCode: 'PL' },
  { code: 'sv', label: 'Svenska', shortCode: 'SV' }
];

const EN_BASE: TranslationKeys = {
  appName: 'Sonacast',
  tagline: 'Music Streaming, Live Lyrics & Real-Time Audio Visualizer',
  brandSubtitle: 'Music & Live Radio',
  navLanding: 'Home',
  navMusic: 'Music',
  navDiscover: 'Your Library',
  navSearch: 'Search',
  navRadio: 'Live Radio',
  navPodcasts: 'Podcasts',
  navVisualizer: 'Orbwave Studio',
  navProofOfStream: 'Proof of Stream',
  navPitchDeck: 'Pitch Deck',
  modeCover: 'Cover Disc',
  modeVideo: 'Music Video',
  modeOrbwave: 'Orbwave Spectrum',
  nowPlaying: 'Now Playing',
  liveRadio: 'Live Radio Stations',
  activePodcasts: 'Curated Podcasts',
  tipArtist: 'Tip Artist',
  directTipTitle: 'Direct Fan Tipping',
  connectWallet: 'Solana Wallet',
  manageWallet: 'Manage',
  lyrics: 'Live Lyrics',
  queue: 'Up Next In Queue',
  upNextCount: 'tracks',
  volume: 'Volume',
  listeners: 'listeners',
  searchPlaceholder: 'Search songs, artists, albums, or lyrics (Queen, Tulus, YOASOBI, Eminem)...',
  searchAction: 'Search',
  audioQuality: '320 kbps Master',
  claimRewards: 'Claim Rewards',
  themeLabel: 'Appearance',
  themeDark: 'Dark',
  themeLight: 'Light',
  languageLabel: 'Language',
  menuButton: 'Menu',
  closeLabel: 'Close',
  reloadLabel: 'Reload',
  topTickerTitle: '85M+ GLOBAL CATALOG ONLINE',
  heroBadge: '85,000,000+ Catalog · 100% Full-Length Start to Finish',
  heroHeadline: 'Listen Now',
  heroSubheadline: 'Your live catalog, mood mixes, and full-length studio playback.',
  heroPrimaryCta: 'Start Listening',
  heroSecondaryCta: 'Music Library',
  heroCatalogCta: 'Search 85M+ Tracks',
  heroPitchCta: 'Pitch Deck',
  landingHighlightsTitle: 'Platform Highlights',
  pillar1Title: '100% Full-Length Playback',
  pillar1Desc: 'Every track plays completely from 0:00 to finish with seamless continuity.',
  pillar2Title: '85M+ Catalog & Live Charts',
  pillar2Desc: 'Popularity-ranked global and regional hits across 1,100+ indexed artists.',
  pillar3Title: '60 FPS Orbwave & Live Lyrics',
  pillar3Desc: 'Real-time client-side Web Audio spectrum synced line by line.',
  pillar4Title: 'Direct Creator Economy',
  pillar4Desc: 'Verified listener rewards and instant Solana Devnet artist tips.',
  featuredMastersHeading: 'Featured Studio Masters',
  chartsHeading: 'Top Popular Charts',
  chartsGlobal: 'Global Top Hits',
  chartsIndonesia: 'Indonesia Top Hits',
  viewFullLibrary: 'View Full Library',
  tuneIn: 'Tune In',
  playEpisode: 'Play Episode',
  uploadLocal: 'Upload Local MP3',
  playerStageToggle: 'Player Stage',
  quickPicks: 'Quick Picks',
  moodAll: 'All Vibes',
  moodFocus: 'Deep Focus',
  moodChill: 'Chill',
  moodUpbeat: 'Upbeat',
  moodWorkout: 'Workout',
  moodIndonesian: 'Indonesian',
  moodClassic: 'Classics',
  moodAcoustic: 'Acoustic',
  moodLateNight: 'Late Night',
  moodParty: 'Party',
  moodRomance: 'Romance',
  moodSleep: 'Sleep',
  likedSongs: 'Liked Songs',
  recentlyPlayed: 'Recently Played',
  playlists: 'Playlists',
  createPlaylist: 'New Playlist',
  playNext: 'Play Next',
  addToQueue: 'Add to Queue',
  startRadio: 'Start Track Radio',
  refreshMix: 'Refresh Mix',
  browseCatalog: 'Browse',
  popularArtists: 'Popular Artists',
  upNext: 'Up Next',
  artistTip: 'Artist Tip',
  nowPlayingSheet: 'Now Playing',
  equalizer: 'Equalizer',
  playbackSpeed: 'Speed',
  sleepTimer: 'Sleep Timer',
  crossfade: 'Crossfade',
  exportLyricCard: 'Save Lyric Card',
  radioAutoMix: 'Autoplay Radio',
  openFullPlayer: 'Full Player',
  shuffleLabel: 'Shuffle',
  repeatLabel: 'Repeat',
  enterPlayerCta: 'Open Web Player',
  editorialEyebrow: 'FULL-LENGTH AUDIO · LIVE LYRICS · PURE RADIO',
  editorialHeroLead: 'Full songs, heard in',
  editorialHeroHighlight: 'living detail.',
  editorialDeck: 'Multi-source global search, synchronized line-by-line lyrics, deterministic track radio, and zero-cutoff playback in one quiet instrument.',
  previewTrackLabel: 'Interactive Preview',
  tryInPlayer: 'Launch Web Player',
  footerExplore: 'Web Player',
  footerProtocol: 'Creator & Project',
  footerTagline: 'Crafted for uninterrupted full-length music listening.',
  navFavorites: 'Favorites & Albums',
  navBlend: 'Blend Music',
  addToAlbum: 'Add to Album',
  createAlbum: 'New Album',
  albumNamePlaceholder: 'Album or collection title...',
  albumDescPlaceholder: 'Optional notes or mood description...',
  personalNotePlaceholder: 'Add a personal memory or note for this song...',
  pinTrack: 'Pin to Top',
  musicBlendHeading: 'Music Blend',
  musicBlendDesc: 'Combine your listening fingerprint with friends or curated taste profiles in Neon Postgres.',
  createBlendBtn: 'Create Friend Blend',
  joinBlendLabel: 'Join Blend Code',
  followedArtistsLabel: 'Followed Artists',
  listeningStatsLabel: 'Listening Stats',
  keyboardShortcutsLabel: 'Shortcuts',
  cloudSyncedLabel: 'Cloud Synced',
  importSharedAlbum: 'Import Shared Album',
  madeForYou: 'Made For You',
  featuredAlbums: 'Featured Studio Albums',
  searchSongsTab: 'Songs',
  searchAlbumsTab: 'Albums',
  searchPlaylistsTab: 'Playlists',
  searchLyricsTab: 'By Lyrics',
  songCreditsLabel: 'Song Credits',
  topDailyAlbums: 'Top Daily Albums',
  watchMusicVideo: 'Watch Video',
  musicVideoBadge: 'Music Video',
  switchVideoVersion: 'Switch Video',
  findingMusicVideo: 'Finding Official Music Video...',
  videoUnavailable: 'Music video embed unavailable for this track',
  audioMasterMode: 'Studio Audio',
  saveQueuePlaylist: 'Save Queue',
  queueSavedPlaylist: 'Queue saved as playlist',
  jumpBackIn: 'Jump Back In',
  expandVideoStage: 'Theater Video',
  topDailyPlaylists: 'Top Daily Playlists',
  moodChoicesLabel: 'Mood & Vibe',
  instantResults: 'Instant Matches',
  playingFrom: 'Playing From',
  queuedByYou: 'Queued by You',
  autoplaySimilar: 'Autoplay Similar Tracks',
  autoNextShort: 'Auto-Next',
  similarClassLabel: 'Similar Class',
  playAlbum: 'Play Album',
  playOrdered: 'Play In Order',
  switchToRadio: 'Switch to Radio',
  authSignIn: 'Sign In',
  authSignUp: 'Create Account',
  authSignOut: 'Sign Out',
  authAccountLabel: 'Account',
  authEmailLabel: 'Email Address',
  authPasswordLabel: 'Password',
  authNameLabel: 'Display Name',
  authGoogleCta: 'Continue with Google',
  authGoogleComingSoon: 'Coming Soon',
  authGoogleDesc: 'Google OAuth sign-in is coming soon. Use email login backed by Neon Postgres.',
  modeMusicOnly: 'Music Only',
  modeOrbwaveOnly: 'Orbwave Only',
  modeVideoOnly: 'Video Only',
  modeLyricsOnly: 'Lyrics Only',
  modeVideoLyric: 'Video + Lyrics',
  modeMusicLyric: 'Music + Lyrics',
  recentSearches: 'Recent Sound Searches',
  clearSearchHistory: 'Clear History',
  removeSearchItem: 'Remove search item',
  lyricsLoading: 'Searching synchronized lyrics across LRCLIB, NetEase & lyrics.ovh...',
  lyricsUnavailable: 'No synced or plain lyrics matched this metadata automatically.',
  lyricsRetry: 'Retry Lyrics',
  lyricsSearchPlaceholder: 'Refine title or artist to search lyrics...',
  lyricsSyncedLabel: 'Synced LRC',
  lyricsTimedLabel: 'Timed Lyrics',
  lowCpuMode: '24/7 Low-CPU Eco',
  lowCpuShort: 'Low CPU',
  minimizeFloating: 'Floating Mini',
  desktopPip: 'Desktop PiP',
  downloadApk: 'Android APK (24/7)',
  clearQueue: 'Clear Queue',
  moveUp: 'Move Up',
  soundAndSleep: 'Sound & Timer',
  lyricCardStudio: 'Lyric Card Studio',
  copyQuote: 'Copy Quote',
  downloadPng: 'Download PNG',
  selectLyricLinesHint: 'Select up to 4 lyric lines to feature on your card',
  artistProfileLabel: 'Artist Profile',
  followArtist: 'Follow',
  followingArtist: 'Following',
  artistTopTracks: 'Popular Tracks',
  artistAlbums: 'Albums & Releases',
  playArtistTopMix: 'Play Top Mix',
  sleepOff: 'Off',
  navVibeFeed: 'Vibe Feed',
  navGroupDiscover: 'Discover',
  navGroupLibrary: 'Collection',
  navGroupExperience: 'Studio & Audio',
  normalizeVolume: 'Loudness Norm',
  karaokeMode: 'Vocal Sing',
  saveOffline: 'Save Offline',
  savedOffline: 'Saved Offline',
  shareTrackLink: 'Copy Share Link',
  resyncLyrics: 'Sync to Live',
  skipBack15: 'Back 15s',
  skipForward15: 'Forward 15s',
  offlineReadyBadge: 'Offline Mode',
  filterBelowPlaceholder: 'Filter shelves below by title, artist, or mood...',
  syncOffsetLabel: 'Lyric Sync',
  syncTooLate: 'Lyrics Late',
  syncTooEarly: 'Lyrics Early',
  syncSnapLine: 'Snap Line',
  syncSnapArmedHint: 'Click the lyric line you hear right now to snap timing',
  syncReset: 'Reset',
  copyLine: 'Copy line',
  copiedLabel: 'Copied',
  exportLibrary: 'Export Playlists (.json)',
  importLibrary: 'Import (.json)'
};

const loc = (overrides: Partial<TranslationKeys>): TranslationKeys => ({
  ...EN_BASE,
  ...overrides
});

export const TRANSLATIONS: Record<Language, TranslationKeys> = {
  en: EN_BASE,
  id: loc({
    tagline: 'Streaming Musik, Lirik Live & Visualizer Audio Real-Time',
    brandSubtitle: 'Musik & Radio Live',
    navLanding: 'Beranda',
    navMusic: 'Musik',
    navDiscover: 'Pustaka Saya',
    navSearch: 'Cari',
    navRadio: 'Radio Langsung',
    navPodcasts: 'Podcast',
    navVisualizer: 'Studio Orbwave',
    navProofOfStream: 'Bukti Streaming',
    navPitchDeck: 'Presentasi',
    modeCover: 'Piringan Cover',
    modeVideo: 'Video Musik',
    modeOrbwave: 'Spektrum Orbwave',
    nowPlaying: 'Sedang Diputar',
    liveRadio: 'Stasiun Radio Langsung',
    activePodcasts: 'Podcast Pilihan',
    tipArtist: 'Apresiasi Musisi',
    directTipTitle: 'Apresiasi Penggemar',
    connectWallet: 'Dompet Solana',
    manageWallet: 'Kelola',
    lyrics: 'Lirik Langsung',
    queue: 'Antrean Berikutnya',
    upNextCount: 'lagu',
    volume: 'Volume',
    listeners: 'pendengar',
    searchPlaceholder: 'Cari lagu, artis, album, atau lirik (Tulus, NOAH, Queen, YOASOBI)...',
    searchAction: 'Cari',
    audioQuality: 'Master 320 kbps',
    claimRewards: 'Klaim Imbalan',
    themeLabel: 'Tampilan',
    themeDark: 'Gelap',
    themeLight: 'Terang',
    languageLabel: 'Bahasa',
    menuButton: 'Menu',
    closeLabel: 'Tutup',
    reloadLabel: 'Muat Ulang',
    topTickerTitle: '85JT+ KATALOG GLOBAL AKTIF',
    heroBadge: '85.000.000+ Katalog · 100% Lagu Penuh Awal sampai Akhir',
    heroHeadline: 'Dengarkan Sekarang',
    heroSubheadline: 'Katalog aktif, mix suasana hati, dan pemutaran studio penuh.',
    heroPrimaryCta: 'Mulai Dengarkan',
    heroSecondaryCta: 'Koleksi Musik',
    heroCatalogCta: 'Cari 85Jt+ Lagu',
    heroPitchCta: 'Pitch Deck',
    landingHighlightsTitle: 'Keunggulan Platform',
    pillar1Title: '100% Durasi Lagu Penuh',
    pillar1Desc: 'Semua lagu diputar utuh dari 0:00 hingga selesai tanpa potongan klip.',
    pillar2Title: '85Jt+ Katalog & Chart Live',
    pillar2Desc: 'Hasil pencarian berperingkat popularitas global dan Indonesia di 1.100+ artis.',
    pillar3Title: 'Orbwave 60 FPS & Lirik Live',
    pillar3Desc: 'Analisis spektrum Web Audio real-time dengan lirik baris demi baris.',
    pillar4Title: 'Ekonomi Kreator Langsung',
    pillar4Desc: 'Bukti pemutaran terverifikasi dan tip artis cepat via Solana Devnet.',
    featuredMastersHeading: 'Master Studio Pilihan',
    chartsHeading: 'Chart Lagu Populer',
    chartsGlobal: 'Top Hits Global',
    chartsIndonesia: 'Top Hits Indonesia',
    viewFullLibrary: 'Buka Koleksi Lengkap',
    tuneIn: 'Putar Radio',
    playEpisode: 'Putar Episode',
    uploadLocal: 'Unggah Audio Lokal',
    playerStageToggle: 'Tampilan Player',
    quickPicks: 'Pilihan Cepat',
    moodAll: 'Semua Mood',
    moodFocus: 'Fokus',
    moodChill: 'Santai',
    moodUpbeat: 'Berenergi',
    moodWorkout: 'Olahraga',
    moodIndonesian: 'Indonesia',
    moodClassic: 'Klasik',
    moodAcoustic: 'Akustik',
    moodLateNight: 'Tengah Malam',
    moodParty: 'Pesta',
    moodRomance: 'Romantis',
    moodSleep: 'Pengantar Tidur',
    likedSongs: 'Lagu Disukai',
    recentlyPlayed: 'Baru Diputar',
    playlists: 'Playlist',
    createPlaylist: 'Buat Playlist',
    playNext: 'Putar Berikutnya',
    addToQueue: 'Tambah ke Antrean',
    startRadio: 'Mulai Radio Lagu',
    refreshMix: 'Perbarui Mix',
    browseCatalog: 'Jelajahi',
    popularArtists: 'Artis Populer',
    upNext: 'Berikutnya',
    artistTip: 'Tip Artis',
    nowPlayingSheet: 'Sedang Diputar',
    equalizer: 'Ekualiser',
    playbackSpeed: 'Kecepatan',
    sleepTimer: 'Timer Tidur',
    crossfade: 'Crossfade',
    exportLyricCard: 'Simpan Kartu Lirik',
    radioAutoMix: 'Autoplay Radio',
    openFullPlayer: 'Layar Penuh',
    shuffleLabel: 'Acak',
    repeatLabel: 'Ulangi',
    enterPlayerCta: 'Masuk ke Web Player',
    editorialEyebrow: 'AUDIO PENUH · LIRIK SINKRON · RADIO MURNI',
    editorialHeroLead: 'Musik utuh dalam',
    editorialHeroHighlight: 'detail yang hidup.',
    editorialDeck: 'Pencarian katalog global lintas bahasa, lirik baris demi baris, radio lagu deterministik tanpa AI, dan pemutaran penuh dari awal hingga akhir.',
    previewTrackLabel: 'Pratinjau Interaktif',
    tryInPlayer: 'Buka di Web Player',
    footerExplore: 'Web Player',
    footerProtocol: 'Kreator & Ekosistem',
    footerTagline: 'Dirancang bersih untuk pengalaman mendengarkan lagu seutuhnya.',
    navFavorites: 'Favorit & Album',
    navBlend: 'Blend Musik',
    addToAlbum: 'Tambah ke Album',
    createAlbum: 'Album Baru',
    albumNamePlaceholder: 'Nama album atau koleksi...',
    albumDescPlaceholder: 'Catatan atau deskripsi mood opsional...',
    personalNotePlaceholder: 'Tulis catatan pribadi untuk lagu ini...',
    pinTrack: 'Sematkan di Atas',
    musicBlendHeading: 'Blend Musik',
    musicBlendDesc: 'Gabungkan profil selera musikmu dengan teman atau kurasi di Neon Postgres.',
    createBlendBtn: 'Buat Undangan Blend',
    joinBlendLabel: 'Gabung Kode Blend',
    followedArtistsLabel: 'Artis Diikuti',
    listeningStatsLabel: 'Statistik Dengar',
    keyboardShortcutsLabel: 'Pintasan',
    cloudSyncedLabel: 'Sinkron Cloud',
    importSharedAlbum: 'Impor Album Teman',
    madeForYou: 'Rekomendasi Pilihan',
    featuredAlbums: 'Album Studio Pilihan',
    searchSongsTab: 'Lagu',
    searchAlbumsTab: 'Album',
    searchPlaylistsTab: 'Playlist',
    searchLyricsTab: 'Cari Lirik',
    songCreditsLabel: 'Kredit Lagu',
    topDailyAlbums: 'Album Top Harian',
    watchMusicVideo: 'Tonton Video',
    musicVideoBadge: 'Video Musik',
    switchVideoVersion: 'Ganti Versi Video',
    findingMusicVideo: 'Mencari Video Musik Resmi...',
    videoUnavailable: 'Video musik tidak tersedia untuk disematkan',
    audioMasterMode: 'Audio Studio',
    saveQueuePlaylist: 'Simpan Antrean',
    queueSavedPlaylist: 'Antrean disimpan sebagai playlist',
    jumpBackIn: 'Lanjutkan Mendengar',
    expandVideoStage: 'Mode Teater',
    topDailyPlaylists: 'Playlist Top Harian',
    moodChoicesLabel: 'Pilihan Mood',
    instantResults: 'Hasil Cepat',
    playingFrom: 'Memutar Dari',
    queuedByYou: 'Antrean Kamu',
    autoplaySimilar: 'Autoplay Lagu Serupa',
    autoNextShort: 'Auto-Next',
    similarClassLabel: 'Kelas Serupa',
    playAlbum: 'Putar Album',
    playOrdered: 'Putar Berurutan',
    switchToRadio: 'Mode Radio',
    authSignIn: 'Masuk',
    authSignUp: 'Buat Akun',
    authSignOut: 'Keluar',
    authAccountLabel: 'Akun',
    authEmailLabel: 'Alamat Email',
    authPasswordLabel: 'Kata Sandi',
    authNameLabel: 'Nama Tampilan',
    authGoogleCta: 'Lanjutkan dengan Google',
    authGoogleComingSoon: 'Segera Hadir',
    authGoogleDesc: 'Login Google OAuth segera hadir. Gunakan login email yang tersinkron di Neon Postgres.',
    modeMusicOnly: 'Musik Saja',
    modeOrbwaveOnly: 'Orbwave Saja',
    modeVideoOnly: 'Video Saja',
    modeLyricsOnly: 'Lirik Saja',
    modeVideoLyric: 'Video + Lirik',
    modeMusicLyric: 'Musik + Lirik',
    recentSearches: 'Riwayat Pencarian Suara',
    clearSearchHistory: 'Hapus Riwayat',
    removeSearchItem: 'Hapus item pencarian',
    lyricsLoading: 'Mencari lirik tersinkronisasi dari LRCLIB, NetEase & lyrics.ovh...',
    lyricsUnavailable: 'Lirik tidak cocok otomatis untuk metadata ini.',
    lyricsRetry: 'Cari Ulang Lirik',
    lyricsSearchPlaceholder: 'Sesuaikan judul atau artis untuk cari lirik...',
    lyricsSyncedLabel: 'LRC Tersinkron',
    lyricsTimedLabel: 'Lirik Bertempo',
    lowCpuMode: 'Hemat CPU 24/7',
    lowCpuShort: 'Hemat CPU',
    minimizeFloating: 'Ikon Mengambang',
    desktopPip: 'PiP Desktop',
    downloadApk: 'APK Android (24/7)',
    clearQueue: 'Kosongkan',
    moveUp: 'Naikkan',
    soundAndSleep: 'Suara & Timer',
    lyricCardStudio: 'Studio Kartu Lirik',
    copyQuote: 'Salin Kutipan',
    downloadPng: 'Unduh PNG',
    selectLyricLinesHint: 'Pilih maksimal 4 baris lirik untuk ditampilkan di kartu',
    artistProfileLabel: 'Profil Artis',
    followArtist: 'Ikuti',
    followingArtist: 'Mengikuti',
    artistTopTracks: 'Lagu Populer',
    artistAlbums: 'Album & Rilisan',
    playArtistTopMix: 'Putar Mix Populer',
    sleepOff: 'Mati',
    navVibeFeed: 'Feed Vibe',
    navGroupDiscover: 'Jelajah',
    navGroupLibrary: 'Koleksi',
    navGroupExperience: 'Studio & Audio',
    normalizeVolume: 'Normalisasi Volume',
    karaokeMode: 'Mode Vokal / Sing',
    saveOffline: 'Simpan Offline',
    savedOffline: 'Tersimpan Offline',
    shareTrackLink: 'Salin Link Lagu',
    resyncLyrics: 'Sinkron ke Aktif',
    skipBack15: 'Mundur 15d',
    skipForward15: 'Maju 15d',
    offlineReadyBadge: 'Mode Offline',
    filterBelowPlaceholder: 'Filter katalog di bawah berdasarkan judul, artis, atau mood...',
    syncOffsetLabel: 'Kalibrasi Lirik',
    syncTooLate: 'Lirik Telat',
    syncTooEarly: 'Lirik Terlalu Cepat',
    syncSnapLine: 'Pas-kan Baris',
    syncSnapArmedHint: 'Klik baris lirik yang sedang terdengar untuk langsung sinkron',
    syncReset: 'Reset',
    copyLine: 'Salin baris',
    copiedLabel: 'Tersalin',
    exportLibrary: 'Ekspor Koleksi (.json)',
    importLibrary: 'Impor (.json)'
  }),
  ms: loc({
    navLanding: 'Halaman Utama',
    navDiscover: 'Pustaka Muzik',
    navSearch: 'Cari 85J+ Lagu',
    navRadio: 'Radio Langsung',
    navVisualizer: 'Studio Orbwave',
    navProofOfStream: 'Bukti Strim',
    themeDark: 'Gelap',
    themeLight: 'Cerah',
    languageLabel: 'Bahasa',
    searchAction: 'Cari',
    heroHeadline: 'Strim Muzik Penuh Asli, Kemas & Tanpa Gangguan.',
    heroPrimaryCta: 'Mula Mendengar',
    heroSecondaryCta: 'Pustaka Muzik',
    chartsGlobal: 'Carta Global',
    chartsIndonesia: 'Carta Serantau',
    viewFullLibrary: 'Lihat Pustaka Penuh',
    tuneIn: 'Dengar Sekarang'
  }),
  jv: loc({
    navLanding: 'Kaca Ngarep',
    navDiscover: 'Koleksi Gending',
    navSearch: 'Golek 85Jt+ Tembang',
    navRadio: 'Radio Langsung',
    themeDark: 'Peteng',
    themeLight: 'Padhang',
    languageLabel: 'Basa',
    searchAction: 'Golek',
    heroHeadline: 'Rungokna Musik Utuh Berkualitas Studio, Resik lan Elegan.',
    heroPrimaryCta: 'Wiwit Ngrungokake',
    heroSecondaryCta: 'Koleksi Musik',
    viewFullLibrary: 'Deleng Koleksi Lengkap'
  }),
  su: loc({
    navLanding: 'Kaca Hareup',
    navDiscover: 'Koleksi Lagu',
    navSearch: 'Teang 85Jt+ Lagu',
    navRadio: 'Radio Langsung',
    themeDark: 'Poek',
    themeLight: 'Caang',
    languageLabel: 'Basa',
    searchAction: 'Teang',
    heroHeadline: 'Dangukeun Musik Lengkep Kualitas Studio, Bersih sareng Elegan.',
    heroPrimaryCta: 'Mimitian Ngadangu',
    heroSecondaryCta: 'Koleksi Musik',
    viewFullLibrary: 'Tingali Koleksi Lengkep'
  }),
  ja: loc({
    enterPlayerCta: 'プレーヤーを開く',
    editorialHeroLead: '音楽を本来の',
    editorialHeroHighlight: 'フル尺と生きた歌詞で。',
    tagline: 'ブラウザ完結型フル尺ストリーミング・同期歌詞・リアルタイムOrbwaveスペクトラム',
    brandSubtitle: 'フル尺オーディオエンジン',
    navLanding: 'ホーム & 概要',
    navDiscover: '音楽ライブラリ',
    navSearch: '8500万曲を検索',
    navRadio: 'ライブラジオ',
    navPodcasts: 'ポッドキャスト',
    navVisualizer: 'Orbwaveスタジオ',
    navProofOfStream: 'ストリーム証明',
    navPitchDeck: 'ピッチデック',
    modeCover: 'カバーディスク',
    modeVideo: 'ミュージックビデオ',
    modeOrbwave: 'Orbwaveスペクトラム',
    nowPlaying: '再生中',
    liveRadio: 'ライブラジオ局',
    activePodcasts: 'ポッドキャスト',
    tipArtist: 'アーティストを応援',
    connectWallet: 'Solanaウォレット',
    lyrics: 'リアルタイム歌詞',
    queue: '再生キュー',
    searchAction: '検索',
    themeDark: 'ダーク',
    themeLight: 'ライト',
    languageLabel: '言語',
    heroHeadline: 'フル尺の音楽を、洗練されたクリーンな体験で。',
    heroPrimaryCta: '再生を始める',
    heroSecondaryCta: 'ライブラリへ',
    viewFullLibrary: 'すべて表示'
  }),
  ko: loc({
    navLanding: '홈 & 소개',
    navDiscover: '음악 라이브러리',
    navSearch: '8500만+ 트랙 검색',
    navRadio: '라이브 라디오',
    navPodcasts: '팟캐스트',
    navVisualizer: 'Orbwave 스튜디오',
    navProofOfStream: '스트림 증명',
    navPitchDeck: '피치 덱',
    searchAction: '검색',
    themeDark: '다크',
    themeLight: '라이트',
    languageLabel: '언어',
    heroHeadline: '완곡 풀타임 스트리밍, 깔끔하고 세련된 오디오 경험.',
    heroPrimaryCta: '지금 감상하기',
    heroSecondaryCta: '라이브러리',
    viewFullLibrary: '전체 보기'
  }),
  zh: loc({
    navLanding: '首页概览',
    navDiscover: '音乐库',
    navSearch: '搜索 8500万+ 曲目',
    navRadio: '实时电台',
    navPodcasts: '播客节目',
    navVisualizer: 'Orbwave 工作室',
    navProofOfStream: '播放证明',
    navPitchDeck: '项目介绍',
    searchAction: '搜索',
    themeDark: '深色',
    themeLight: '浅色',
    languageLabel: '语言',
    heroHeadline: '畅听原声完整版音乐，简洁优雅，全端自适应。',
    heroPrimaryCta: '立即播放',
    heroSecondaryCta: '打开音乐库',
    viewFullLibrary: '查看全部'
  }),
  'zh-TW': loc({
    navLanding: '首頁概覽',
    navDiscover: '音樂庫',
    navSearch: '搜尋 8500萬+ 曲目',
    navRadio: '即時電台',
    navPodcasts: 'Podcast',
    navVisualizer: 'Orbwave 工作室',
    navProofOfStream: '串流證明',
    navPitchDeck: '簡報介紹',
    searchAction: '搜尋',
    themeDark: '深色',
    themeLight: '淺色',
    languageLabel: '語言',
    heroHeadline: '暢聽原聲完整版音樂，簡潔優雅、全裝置流暢體驗。',
    heroPrimaryCta: '立即收聽',
    heroSecondaryCta: '進入音樂庫',
    viewFullLibrary: '瀏覽完整曲庫'
  }),
  es: loc({
    tagline: 'Streaming completo, letras sincronizadas y motor de espectro Orbwave',
    navLanding: 'Inicio y Portada',
    navDiscover: 'Biblioteca Musical',
    navSearch: 'Buscar 85M+ Canciones',
    navRadio: 'Radio en Vivo',
    navPodcasts: 'Pódcasts',
    navVisualizer: 'Estudio Orbwave',
    navProofOfStream: 'Prueba de Stream',
    navPitchDeck: 'Presentación',
    searchAction: 'Buscar',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    languageLabel: 'Idioma',
    heroHeadline: 'Escucha música original completa, con diseño limpio y profesional.',
    heroPrimaryCta: 'Empezar a Escuchar',
    heroSecondaryCta: 'Biblioteca Musical',
    viewFullLibrary: 'Ver Biblioteca'
  }),
  fr: loc({
    navLanding: 'Accueil & Vitrine',
    navDiscover: 'Bibliothèque',
    navSearch: 'Rechercher 85M+ Titres',
    navRadio: 'Radio en Direct',
    navPodcasts: 'Podcasts',
    navVisualizer: 'Studio Orbwave',
    navProofOfStream: 'Preuve d’Écoute',
    navPitchDeck: 'Présentation',
    searchAction: 'Rechercher',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    languageLabel: 'Langue',
    heroHeadline: 'Écoutez la musique originale en entier, sobrement et partout.',
    heroPrimaryCta: 'Écouter Maintenant',
    heroSecondaryCta: 'Bibliothèque',
    viewFullLibrary: 'Voir tout le catalogue'
  }),
  de: loc({
    navLanding: 'Start & Übersicht',
    navDiscover: 'Musikbibliothek',
    navSearch: '85M+ Titel suchen',
    navRadio: 'Live-Radio',
    navPodcasts: 'Podcasts',
    navVisualizer: 'Orbwave-Studio',
    navProofOfStream: 'Stream-Nachweis',
    navPitchDeck: 'Präsentation',
    searchAction: 'Suchen',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    languageLabel: 'Sprache',
    heroHeadline: 'Originale Musik in voller Länge, klar strukturiert auf jedem Gerät.',
    heroPrimaryCta: 'Jetzt anhören',
    heroSecondaryCta: 'Musikbibliothek',
    viewFullLibrary: 'Bibliothek öffnen'
  }),
  pt: loc({
    navLanding: 'Início e Visão Geral',
    navDiscover: 'Biblioteca Musical',
    navSearch: 'Buscar 85M+ Músicas',
    navRadio: 'Rádio ao Vivo',
    navPodcasts: 'Podcasts',
    navVisualizer: 'Estúdio Orbwave',
    navProofOfStream: 'Prova de Stream',
    navPitchDeck: 'Apresentação',
    searchAction: 'Buscar',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    languageLabel: 'Idioma',
    heroHeadline: 'Ouça músicas completas originais, limpas e responsivas.',
    heroPrimaryCta: 'Começar a Ouvir',
    heroSecondaryCta: 'Biblioteca',
    viewFullLibrary: 'Ver Biblioteca'
  }),
  it: loc({
    navLanding: 'Home e Panoramica',
    navDiscover: 'Libreria Musicale',
    navSearch: 'Cerca 85M+ Brani',
    navRadio: 'Radio in Diretta',
    navPodcasts: 'Podcast',
    navVisualizer: 'Studio Orbwave',
    navProofOfStream: 'Prova di Stream',
    navPitchDeck: 'Presentazione',
    searchAction: 'Cerca',
    themeDark: 'Scuro',
    themeLight: 'Chiaro',
    languageLabel: 'Lingua',
    heroHeadline: 'Musica originale integrale, design pulito su desktop e mobile.',
    heroPrimaryCta: 'Inizia ad Ascoltare',
    heroSecondaryCta: 'Libreria'
  }),
  nl: loc({
    navLanding: 'Overzicht & Home',
    navDiscover: 'Muziekbibliotheek',
    navSearch: 'Zoek 85M+ Nummers',
    navRadio: 'Live Radio',
    searchAction: 'Zoeken',
    themeDark: 'Donker',
    themeLight: 'Licht',
    languageLabel: 'Taal',
    heroHeadline: 'Volledige muziekstreaming, helder ontworpen voor elk scherm.',
    heroPrimaryCta: 'Direct Luisteren',
    heroSecondaryCta: 'Bibliotheek'
  }),
  ru: loc({
    navLanding: 'Главная и обзор',
    navDiscover: 'Фонотека',
    navSearch: 'Поиск 85M+ треков',
    navRadio: 'Прямое радио',
    navPodcasts: 'Подкасты',
    navVisualizer: 'Студия Orbwave',
    navProofOfStream: 'Proof of Stream',
    navPitchDeck: 'Презентация',
    searchAction: 'Найти',
    themeDark: 'Тёмная',
    themeLight: 'Светлая',
    languageLabel: 'Язык',
    heroHeadline: 'Слушайте полные оригинальные треки без ограничений и на любом экране.',
    heroPrimaryCta: 'Начать прослушивание',
    heroSecondaryCta: 'Фонотека'
  }),
  ar: loc({
    navLanding: 'الرئيسية والعرض',
    navDiscover: 'مكتبة الموسيقى',
    navSearch: 'بحث في 85 مليون+ أغنية',
    navRadio: 'راديو مباشر',
    navPodcasts: 'بودكاست',
    navVisualizer: 'استوديو Orbwave',
    navProofOfStream: 'إثبات البث',
    navPitchDeck: 'العرض التقديمي',
    searchAction: 'بحث',
    themeDark: 'داكن',
    themeLight: 'فاتح',
    languageLabel: 'اللغة',
    heroHeadline: 'استمع إلى الموسيقى الأصلية كاملة بجودة عالية وتصميم أنيق.',
    heroPrimaryCta: 'ابدأ الاستماع',
    heroSecondaryCta: 'المكتبة'
  }),
  hi: loc({
    navLanding: 'होम और परिचय',
    navDiscover: 'म्यूज़िक लाइब्रेरी',
    navSearch: '85M+ गाने खोजें',
    navRadio: 'लाइव रेडियो',
    navPodcasts: 'पॉडकास्ट',
    searchAction: 'खोजें',
    themeDark: 'डार्क',
    themeLight: 'लाइट',
    languageLabel: 'भाषा',
    heroHeadline: 'पूरी लंबाई का मूल संगीत सुनें — साफ और आधुनिक अनुभव।',
    heroPrimaryCta: 'सुनना शुरू करें',
    heroSecondaryCta: 'लाइब्रेरी खोलें'
  }),
  th: loc({
    navLanding: 'หน้าแรก',
    navDiscover: 'คลังเพลง',
    navSearch: 'ค้นหา 85M+ เพลง',
    navRadio: 'วิทยุสด',
    navPodcasts: 'พอดแคสต์',
    searchAction: 'ค้นหา',
    themeDark: 'มืด',
    themeLight: 'สว่าง',
    languageLabel: 'ภาษา',
    heroHeadline: 'สตรีมเพลงฉบับเต็มคมชัด ใช้งานลื่นไหลทั้งบนคอมและมือถือ',
    heroPrimaryCta: 'เริ่มฟังตอนนี้',
    heroSecondaryCta: 'คลังเพลง'
  }),
  vi: loc({
    navLanding: 'Trang chủ',
    navDiscover: 'Thư viện nhạc',
    navSearch: 'Tìm 85M+ bài hát',
    navRadio: 'Radio trực tiếp',
    navPodcasts: 'Podcast',
    searchAction: 'Tìm',
    themeDark: 'Tối',
    themeLight: 'Sáng',
    languageLabel: 'Ngôn ngữ',
    heroHeadline: 'Nghe trọn vẹn bản nhạc gốc với giao diện tinh gọn trên mọi thiết bị.',
    heroPrimaryCta: 'Bắt đầu nghe',
    heroSecondaryCta: 'Thư viện'
  }),
  tl: loc({
    navLanding: 'Panimula at Tahanan',
    navDiscover: 'Koleksyon ng Musika',
    navSearch: 'Maghanap ng 85M+ Kanta',
    navRadio: 'Live na Radyo',
    searchAction: 'Hanapin',
    themeDark: 'Madilim',
    themeLight: 'Maliwanag',
    languageLabel: 'Wika',
    heroHeadline: 'Makinig ng kumpletong kanta mula simula hanggang dulo, malinis sa anumang screen.',
    heroPrimaryCta: 'Makinig Ngayon',
    heroSecondaryCta: 'Koleksyon'
  }),
  tr: loc({
    navLanding: 'Ana Sayfa',
    navDiscover: 'Müzik Arşivi',
    navSearch: '85M+ Parça Ara',
    navRadio: 'Canlı Radyo',
    navPodcasts: 'Podcastler',
    searchAction: 'Ara',
    themeDark: 'Koyu',
    themeLight: 'Açık',
    languageLabel: 'Dil',
    heroHeadline: 'Orijinal tam şarkıları sade ve profesyonel tasarımla her cihazda dinleyin.',
    heroPrimaryCta: 'Dinlemeye Başla',
    heroSecondaryCta: 'Müzik Arşivi'
  }),
  pl: loc({
    navLanding: 'Strona główna',
    navDiscover: 'Biblioteka muzyki',
    navSearch: 'Szukaj 85M+ utworów',
    navRadio: 'Radio na żywo',
    searchAction: 'Szukaj',
    themeDark: 'Ciemny',
    themeLight: 'Jasny',
    languageLabel: 'Język',
    heroHeadline: 'Odtwarzaj pełne oryginalne utwory w przejrzystym, eleganckim interfejsie.',
    heroPrimaryCta: 'Rozpocznij słuchanie',
    heroSecondaryCta: 'Biblioteka'
  }),
  sv: loc({
    navLanding: 'Översikt & Hem',
    navDiscover: 'Musikbibliotek',
    navSearch: 'Sök 85M+ låtar',
    navRadio: 'Direktradio',
    searchAction: 'Sök',
    themeDark: 'Mörkt',
    themeLight: 'Ljust',
    languageLabel: 'Språk',
    heroHeadline: 'Strömma fullängdsmusik i original med stilren design på dator och mobil.',
    heroPrimaryCta: 'Börja lyssna',
    heroSecondaryCta: 'Musikbibliotek'
  })
};
