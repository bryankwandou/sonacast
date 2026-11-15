import { ARTISTS_DIRECTORY, type IndexedArtist } from '../data/artists800';
import type {
  EqPreset,
  LyricLine,
  MoodPreset,
  RepeatMode,
  Track,
  UserPlaylist
} from '../types';

const STORAGE_KEY = 'sonacast_rec_engine_v1';

export interface RecommendationState {
  likedTracks: Track[];
  recentTracks: Track[];
  playlists: UserPlaylist[];
  artistAffinity: Record<string, number>;
  genreAffinity: Record<string, number>;
  skippedAtByTrackId: Record<string, number>;
  shuffle: boolean;
  repeatMode: RepeatMode;
  autoplayDefaultApplied?: boolean;
  playbackRate: number;
  eqPreset: EqPreset;
  crossfadeSeconds: number;
}

export const DEFAULT_RECOMMENDATION_STATE: RecommendationState = {
  likedTracks: [],
  recentTracks: [],
  playlists: [],
  artistAffinity: {},
  genreAffinity: {},
  skippedAtByTrackId: {},
  shuffle: false,
  repeatMode: 'off',
  autoplayDefaultApplied: true,
  playbackRate: 1,
  eqPreset: 'flat',
  crossfadeSeconds: 2
};

export type MoodLabelKey =
  | 'moodAll'
  | 'moodFocus'
  | 'moodChill'
  | 'moodUpbeat'
  | 'moodWorkout'
  | 'moodLateNight'
  | 'moodParty'
  | 'moodRomance'
  | 'moodSleep'
  | 'moodIndonesian'
  | 'moodClassic'
  | 'moodAcoustic';

export const MOOD_PRESETS: {
  id: MoodPreset;
  labelKey: MoodLabelKey;
  bpmRange: [number, number];
  searchQuery: string;
}[] = [
  { id: 'all', labelKey: 'moodAll', bpmRange: [60, 180], searchQuery: 'Top Hits' },
  { id: 'focus', labelKey: 'moodFocus', bpmRange: [60, 108], searchQuery: 'Deep Focus Instrumental' },
  { id: 'chill', labelKey: 'moodChill', bpmRange: [65, 105], searchQuery: 'Chill Vibes' },
  { id: 'upbeat', labelKey: 'moodUpbeat', bpmRange: [110, 145], searchQuery: 'Happy Hits Pop' },
  { id: 'workout', labelKey: 'moodWorkout', bpmRange: [120, 178], searchQuery: 'Workout Energy' },
  { id: 'lateNight', labelKey: 'moodLateNight', bpmRange: [62, 108], searchQuery: 'Late Night R&B' },
  { id: 'party', labelKey: 'moodParty', bpmRange: [118, 165], searchQuery: 'Party Dance Hits' },
  { id: 'romance', labelKey: 'moodRomance', bpmRange: [65, 110], searchQuery: 'Love Songs Ballads' },
  { id: 'sleep', labelKey: 'moodSleep', bpmRange: [50, 92], searchQuery: 'Sleep Piano Ambient' },
  { id: 'indonesian', labelKey: 'moodIndonesian', bpmRange: [70, 130], searchQuery: 'Musik Indonesia Hits' },
  { id: 'classic', labelKey: 'moodClassic', bpmRange: [75, 140], searchQuery: 'Classic Greatest Hits' },
  { id: 'acoustic', labelKey: 'moodAcoustic', bpmRange: [62, 114], searchQuery: 'Acoustic Session' }
];

export function getMoodLabel(
  mood: MoodPreset,
  translations: Record<MoodLabelKey, string>
): string {
  const preset = MOOD_PRESETS.find((item) => item.id === mood);
  return preset ? translations[preset.labelKey] : translations.moodAll;
}

export function getMoodSearchQuery(mood: MoodPreset): string {
  const preset = MOOD_PRESETS.find((item) => item.id === mood);
  return preset ? preset.searchQuery : 'Top Hits';
}

type GenreFamily =
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'electronic'
  | 'rnb'
  | 'kpop'
  | 'jpop'
  | 'indonesian'
  | 'latin'
  | 'acoustic'
  | 'jazz'
  | 'classical'
  | 'global';

export type SonicClassId =
  | 'piano_neoclassical'
  | 'soundtrack_epic'
  | 'indo_pop_ballad'
  | 'indo_band_rock'
  | 'indo_indie_folk'
  | 'indo_koplo_dangdut'
  | 'rnb_late_soul'
  | 'classic_global_legend'
  | 'modern_chart_pop'
  | 'kpop_idol'
  | 'jpop_city_anime'
  | 'alt_indie_rock'
  | 'heavy_metal_hard'
  | 'electronic_dance_synth'
  | 'hiphop_rap_trap'
  | 'jazz_blues_acoustic'
  | 'latin_global';

export interface SonicClassProfile {
  classId: SonicClassId;
  classLabel: string;
  isInstrumental: boolean;
  compatibleClasses: SonicClassId[];
  peerArtists: string[];
  keywords: string[];
}

const SONIC_CLASS_PROFILES: Record<SonicClassId, SonicClassProfile> = {
  piano_neoclassical: {
    classId: 'piano_neoclassical',
    classLabel: 'Piano & Neoclassical',
    isInstrumental: true,
    compatibleClasses: ['soundtrack_epic', 'jazz_blues_acoustic'],
    peerArtists: ['Yiruma', 'Ludovico Einaudi', 'Max Richter', 'Joe Hisaishi', 'Frederic Chopin', 'Ryuichi Sakamoto'],
    keywords: ['chopin', 'debussy', 'mozart', 'beethoven', 'yiruma', 'ludovico einaudi', 'max richter', 'ryuichi sakamoto', 'joe hisaishi', 'lang lang', 'yo-yo ma', '2cellos']
  },
  soundtrack_epic: {
    classId: 'soundtrack_epic',
    classLabel: 'Film Score & Orchestral',
    isInstrumental: true,
    compatibleClasses: ['piano_neoclassical'],
    peerArtists: ['Hans Zimmer', 'John Williams', 'Ramin Djawadi', 'Howard Shore', 'Ennio Morricone', 'Ludwig Goransson'],
    keywords: ['hans zimmer', 'john williams', 'ramin djawadi', 'howard shore', 'ennio morricone', 'thomas bergersen', 'two steps from hell', 'hiroyuki sawano', 'kensuke ushio']
  },
  indo_pop_ballad: {
    classId: 'indo_pop_ballad',
    classLabel: 'Indo Pop & Ballad Soul',
    isInstrumental: false,
    compatibleClasses: ['indo_band_rock', 'indo_indie_folk', 'rnb_late_soul'],
    peerArtists: ['Tulus', 'Raisa', 'Afgan', 'Glenn Fredly', 'Nadin Amizah', 'Mahalini', 'Tiara Andini', 'Judika', 'Lyodra', 'Bernadya'],
    keywords: ['tulus', 'raisa', 'afgan', 'glenn fredly', 'judika', 'mahalini', 'tiara andini', 'lyodra', 'ziva magnolya', 'bernadya', 'nadin amizah', 'pamungkas', 'rizky febian', 'juicy luicy', 'virgoun', 'budi doremi', 'rossa', 'bunga citra lestari', 'isyana sarasvati', 'yura yunita', 'sal priadi', 'siti nurhaliza', 'maher zain']
  },
  indo_band_rock: {
    classId: 'indo_band_rock',
    classLabel: 'Indo Band & Pop Rock',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_indie_folk', 'alt_indie_rock'],
    peerArtists: ['Sheila On 7', 'Dewa 19', 'Noah', 'Padi', 'Peterpan', 'Gigi', 'Ada Band', 'Chrisye', 'Nidji'],
    keywords: ['dewa 19', 'sheila on 7', 'noah', 'peterpan', 'padi', 'gigi', 'ada band', 'chrisye', 'ungu', 'nidji', 'd\'masiv', 'letto', 'slank', 'armada', 'seventeen', 'kahitna', 'yovie']
  },
  indo_indie_folk: {
    classId: 'indo_indie_folk',
    classLabel: 'Indo Indie & Folk',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_band_rock', 'alt_indie_rock', 'jazz_blues_acoustic'],
    peerArtists: ['Hindia', 'Payung Teduh', 'Fourtwnty', 'Efek Rumah Kaca', 'Reality Club', 'Banda Neira', 'Feby Putri', 'Kunto Aji'],
    keywords: ['hindia', 'feast', 'efek rumah kaca', 'payung teduh', 'fourtwnty', 'banda neira', 'reality club', 'barasuara', 'feby putri', 'kunto aji', 'fiersa besari', 'dere', 'idgitaf', 'iwan fals']
  },
  indo_koplo_dangdut: {
    classId: 'indo_koplo_dangdut',
    classLabel: 'Indo Dangdut & Koplo',
    isInstrumental: false,
    compatibleClasses: ['indo_band_rock', 'latin_global'],
    peerArtists: ['Denny Caknan', 'Happy Asmara', 'Guyon Waton', 'NDX A.K.A.', 'Wali', 'Didi Kempot'],
    keywords: ['denny caknan', 'happy asmara', 'ndx', 'guyon waton', 'wali', 'kangen band', 'st12', 'didi kempot', 'rhoma irama']
  },
  rnb_late_soul: {
    classId: 'rnb_late_soul',
    classLabel: 'R&B & Late-Night Soul',
    isInstrumental: false,
    compatibleClasses: ['modern_chart_pop', 'hiphop_rap_trap', 'jazz_blues_acoustic', 'indo_pop_ballad'],
    peerArtists: ['Frank Ocean', 'The Weeknd', 'SZA', 'Daniel Caesar', 'Giveon', 'Brent Faiyaz', 'Joji', 'NIKI', 'Khalid'],
    keywords: ['the weeknd', 'frank ocean', 'sza', 'daniel caesar', 'giveon', 'brent faiyaz', 'joji', 'niki', 'khalid', 'h.e.r.', 'summer walker', 'usher', 'alicia keys', 'john legend', 'miguel', 'anderson .paak', 'steve lacy', 'kali uchis', 'keshi', 'sade', 'tems', 'tyla', 'burna boy']
  },
  classic_global_legend: {
    classId: 'classic_global_legend',
    classLabel: 'Classic Global Anthem',
    isInstrumental: false,
    compatibleClasses: ['alt_indie_rock', 'jazz_blues_acoustic', 'modern_chart_pop'],
    peerArtists: ['Queen', 'The Beatles', 'Michael Jackson', 'Fleetwood Mac', 'Elton John', 'Whitney Houston', 'Eagles', 'ABBA'],
    keywords: ['queen', 'the beatles', 'beatles', 'michael jackson', 'whitney houston', 'elton john', 'fleetwood mac', 'eagles', 'abba', 'billy joel', 'stevie wonder', 'prince', 'george michael', 'celine dion', 'mariah carey', 'pink floyd', 'led zeppelin', 'rolling stones', 'phil collins', 'bob marley']
  },
  modern_chart_pop: {
    classId: 'modern_chart_pop',
    classLabel: 'Modern Global Pop',
    isInstrumental: false,
    compatibleClasses: ['rnb_late_soul', 'electronic_dance_synth', 'kpop_idol', 'alt_indie_rock'],
    peerArtists: ['Taylor Swift', 'Dua Lipa', 'Ariana Grande', 'Billie Eilish', 'Bruno Mars', 'Ed Sheeran', 'Harry Styles', 'Sabrina Carpenter', 'Olivia Rodrigo'],
    keywords: ['taylor swift', 'dua lipa', 'ariana grande', 'billie eilish', 'olivia rodrigo', 'sabrina carpenter', 'harry styles', 'bruno mars', 'ed sheeran', 'justin bieber', 'shawn mendes', 'charlie puth', 'benson boone', 'teddy swims', 'chappell roan', 'adele', 'sam smith', 'maroon 5', 'lady gaga', 'rihanna', 'katy perry']
  },
  kpop_idol: {
    classId: 'kpop_idol',
    classLabel: 'K-Pop Studio Hits',
    isInstrumental: false,
    compatibleClasses: ['jpop_city_anime', 'modern_chart_pop', 'rnb_late_soul', 'electronic_dance_synth'],
    peerArtists: ['BTS', 'BLACKPINK', 'NewJeans', 'SEVENTEEN', 'TWICE', 'Stray Kids', 'aespa', 'IVE', 'LE SSERAFIM', 'IU'],
    keywords: ['bts', 'blackpink', 'newjeans', 'seventeen', 'stray kids', 'twice', 'aespa', 'ive', 'le sserafim', 'iu', 'jungkook', 'jennie', 'rose', 'lisa', 'exo', 'nct', 'txt', 'enhypen', 'red velvet', 'itzy', 'babymonster']
  },
  jpop_city_anime: {
    classId: 'jpop_city_anime',
    classLabel: 'J-Pop, Anime & City Pop',
    isInstrumental: false,
    compatibleClasses: ['kpop_idol', 'modern_chart_pop', 'alt_indie_rock', 'electronic_dance_synth'],
    peerArtists: ['YOASOBI', 'Kenshi Yonezu', 'Fujii Kaze', 'Official HIGE DANDism', 'Ado', 'Vaundy', 'Yorushika', 'Aimer'],
    keywords: ['yoasobi', 'kenshi yonezu', 'fujii kaze', 'ado', 'official hige', 'king gnu', 'yorushika', 'vaundy', 'mrs. green apple', 'one ok rock', 'radwimps', 'lisa', 'aimer', 'mariya takeuchi', 'miki matsubara', 'tatsuro yamashita', 'hikaru utada', 'creepy nuts', 'imase']
  },
  alt_indie_rock: {
    classId: 'alt_indie_rock',
    classLabel: 'Alternative & Indie Rock',
    isInstrumental: false,
    compatibleClasses: ['classic_global_legend', 'modern_chart_pop', 'indo_indie_folk', 'heavy_metal_hard'],
    peerArtists: ['Coldplay', 'Arctic Monkeys', 'Radiohead', 'Tame Impala', 'Lana Del Rey', 'The 1975', 'Muse', 'Oasis', 'Cigarettes After Sex'],
    keywords: ['coldplay', 'arctic monkeys', 'radiohead', 'muse', 'oasis', 'tame impala', 'lana del rey', 'cigarettes after sex', 'mac demarco', 'the 1975', 'the neighbourhood', 'imagine dragons', 'onerepublic', 'linkin park', 'nirvana', 'foo fighters', 'green day', 'red hot chili peppers', 'the killers', 'vampire weekend', 'clairo', 'phoebe bridgers', 'mitski']
  },
  heavy_metal_hard: {
    classId: 'heavy_metal_hard',
    classLabel: 'Hard Rock & Metal',
    isInstrumental: false,
    compatibleClasses: ['alt_indie_rock', 'classic_global_legend'],
    peerArtists: ['Metallica', 'AC/DC', 'Iron Maiden', 'Slipknot', 'Bring Me The Horizon', 'Avenged Sevenfold', 'Guns N\' Roses'],
    keywords: ['metallica', 'iron maiden', 'megadeth', 'slayer', 'slipknot', 'system of a down', 'deftones', 'tool', 'avenged sevenfold', 'bring me the horizon', 'ac/dc', 'guns n\' roses', 'black sabbath', 'rammstein', 'burgerkill', 'seringai']
  },
  electronic_dance_synth: {
    classId: 'electronic_dance_synth',
    classLabel: 'Electronic, House & Synth',
    isInstrumental: false,
    compatibleClasses: ['modern_chart_pop', 'kpop_idol', 'jpop_city_anime', 'hiphop_rap_trap'],
    peerArtists: ['Daft Punk', 'Calvin Harris', 'Kygo', 'Avicii', 'Fred again..', 'Disclosure', 'Zedd', 'Martin Garrix', 'Odesza'],
    keywords: ['daft punk', 'calvin harris', 'david guetta', 'avicii', 'martin garrix', 'kygo', 'zedd', 'alan walker', 'fred again', 'disclosure', 'peggy gou', 'odesza', 'flume', 'm83', 'skrillex', 'the chainsmokers', 'marshmello', 'tiesto', 'armin van buuren', 'deadmau5', 'justice', 'kavinsky']
  },
  hiphop_rap_trap: {
    classId: 'hiphop_rap_trap',
    classLabel: 'Hip-Hop, Rap & Melodic Trap',
    isInstrumental: false,
    compatibleClasses: ['rnb_late_soul', 'electronic_dance_synth', 'latin_global'],
    peerArtists: ['Kendrick Lamar', 'Drake', 'Travis Scott', 'Eminem', 'J. Cole', 'Post Malone', 'Tyler, The Creator', 'Rich Brian'],
    keywords: ['eminem', 'drake', 'kendrick lamar', 'post malone', 'travis scott', 'kanye west', 'jay-z', 'nas', 'tupac', 'notorious', 'snoop dogg', 'j. cole', 'tyler, the creator', 'future', '21 savage', 'metro boomin', 'juice wrld', 'central cee', 'rich brian', 'nf']
  },
  jazz_blues_acoustic: {
    classId: 'jazz_blues_acoustic',
    classLabel: 'Jazz, Acoustic & Warm Vocals',
    isInstrumental: false,
    compatibleClasses: ['rnb_late_soul', 'piano_neoclassical', 'classic_global_legend', 'indo_indie_folk'],
    peerArtists: ['Laufey', 'Norah Jones', 'Frank Sinatra', 'John Mayer', 'Amy Winehouse', 'Miles Davis', 'Chet Baker', 'Bon Iver'],
    keywords: ['laufey', 'norah jones', 'frank sinatra', 'nat king cole', 'chet baker', 'miles davis', 'john coltrane', 'amy winehouse', 'billie holiday', 'ella fitzgerald', 'nina simone', 'john mayer', 'bon iver', 'hozier', 'noah kahan', 'jason mraz', 'ed sheeran', 'passenger', 'johnny cash', 'chris stapleton']
  },
  latin_global: {
    classId: 'latin_global',
    classLabel: 'Latin & Afro Rhythms',
    isInstrumental: false,
    compatibleClasses: ['modern_chart_pop', 'hiphop_rap_trap', 'rnb_late_soul'],
    peerArtists: ['Bad Bunny', 'Shakira', 'Karol G', 'J Balvin', 'Rosalia', 'Feid', 'Rauw Alejandro', 'RemA'],
    keywords: ['bad bunny', 'shakira', 'karol g', 'j balvin', 'maluma', 'ozuna', 'feid', 'rauw alejandro', 'rosalia', 'daddy yankee', 'luis fonsi', 'peso pluma', 'anitta']
  }
};

export function normalizeBaseTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(live|remix|remaster(?:ed)?|acoustic|slowed|reverb|cover|version|edit|radio)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyTrackTier(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'>
): SonicClassProfile {
  const artistLower = String(track.artist || '').toLowerCase();
  const titleLower = String(track.title || '').toLowerCase();
  const genreLower = String(track.genre || '').toLowerCase();

  // Check explicit instrumental / classical cues first so piano pieces never cross into vocal pop
  if (
    /\b(nocturne|sonata|concerto|prelude|etude|piano solo|symphony|opus|op\.\s*\d|instrumental)\b/.test(
      titleLower
    )
  ) {
    return SONIC_CLASS_PROFILES.piano_neoclassical;
  }

  for (const profile of Object.values(SONIC_CLASS_PROFILES)) {
    if (profile.keywords.some((kw) => artistLower.includes(kw))) {
      return profile;
    }
  }

  const family = resolveGenreFamily(genreLower, artistLower);
  if (family === 'classical') {
    return genreLower.includes('soundtrack')
      ? SONIC_CLASS_PROFILES.soundtrack_epic
      : SONIC_CLASS_PROFILES.piano_neoclassical;
  }
  if (family === 'indonesian') {
    if (genreLower.includes('dangdut') || genreLower.includes('koplo')) return SONIC_CLASS_PROFILES.indo_koplo_dangdut;
    if (genreLower.includes('indie') || genreLower.includes('folk')) return SONIC_CLASS_PROFILES.indo_indie_folk;
    if (genreLower.includes('rock') || genreLower.includes('band')) return SONIC_CLASS_PROFILES.indo_band_rock;
    return SONIC_CLASS_PROFILES.indo_pop_ballad;
  }
  if (family === 'kpop') return SONIC_CLASS_PROFILES.kpop_idol;
  if (family === 'jpop') return SONIC_CLASS_PROFILES.jpop_city_anime;
  if (family === 'rnb') return SONIC_CLASS_PROFILES.rnb_late_soul;
  if (family === 'hiphop') return SONIC_CLASS_PROFILES.hiphop_rap_trap;
  if (family === 'electronic') return SONIC_CLASS_PROFILES.electronic_dance_synth;
  if (family === 'latin') return SONIC_CLASS_PROFILES.latin_global;
  if (family === 'jazz' || family === 'acoustic') return SONIC_CLASS_PROFILES.jazz_blues_acoustic;
  if (family === 'rock') {
    return genreLower.includes('metal') || genreLower.includes('punk') || (track.bpm || 0) >= 148
      ? SONIC_CLASS_PROFILES.heavy_metal_hard
      : SONIC_CLASS_PROFILES.alt_indie_rock;
  }
  return SONIC_CLASS_PROFILES.modern_chart_pop;
}

const GENRE_COMPATIBILITY: Record<GenreFamily, GenreFamily[]> = {
  pop: ['indonesian', 'rnb', 'kpop', 'jpop', 'electronic', 'latin'],
  rock: ['acoustic', 'pop', 'electronic'],
  hiphop: ['rnb', 'electronic', 'pop', 'latin'],
  electronic: ['pop', 'hiphop', 'jpop', 'kpop'],
  rnb: ['pop', 'hiphop', 'jazz', 'indonesian'],
  kpop: ['pop', 'electronic', 'rnb', 'jpop'],
  jpop: ['pop', 'electronic', 'kpop', 'rock'],
  indonesian: ['pop', 'acoustic', 'rnb', 'global'],
  latin: ['pop', 'hiphop', 'rnb'],
  acoustic: ['pop', 'rock', 'jazz', 'indonesian'],
  jazz: ['rnb', 'acoustic', 'classical'],
  classical: ['jazz', 'acoustic'],
  global: ['pop', 'indonesian', 'latin', 'acoustic']
};

export function extractPrimaryArtist(artist: string): string {
  return String(artist || '')
    .split(/\s*(?:,|feat\.?|ft\.?|&| x )\s*/i)[0]
    .trim()
    .toLowerCase();
}

export function resolveGenreFamily(genre: string, artist = ''): GenreFamily {
  const g = String(genre || '').toLowerCase();
  const a = String(artist || '').toLowerCase();

  if (
    g.includes('indonesia') ||
    g.includes('indo') ||
    g.includes('dangdut') ||
    ['tulus', 'noah', 'sheila on 7', 'raisa', 'dewa 19', 'isyana', 'nadin amizah', 'mahalini', 'tiara andini', 'judika', 'rossa', 'peterpan', 'slank', 'iwan fals', 'pamungkas', 'hindia', 'feast', 'barasuara', 'efek rumah kaca', 'payung teduh', 'fourtwnty', 'kunto aji', 'rizky febian', 'ziva magnolya', 'lyodra', 'virgoun', 'budi doremi', 'wali', 'ungu', 'st12', 'kangen band', 'raffa affar', 'denny caknan', 'happy asmara'].some((k) => a.includes(k))
  ) {
    return 'indonesian';
  }
  if (g.includes('k-pop') || g.includes('kpop') || g.includes('korean')) return 'kpop';
  if (g.includes('j-pop') || g.includes('jpop') || g.includes('anime') || g.includes('city pop')) return 'jpop';
  if (g.includes('hip') || g.includes('rap') || g.includes('trap')) return 'hiphop';
  if (g.includes('r&b') || g.includes('rnb') || g.includes('soul')) return 'rnb';
  if (g.includes('edm') || g.includes('synth') || g.includes('techno') || g.includes('house') || g.includes('electro') || g.includes('ambient') || g.includes('lo-fi') || g.includes('lofi')) return 'electronic';
  if (g.includes('rock') || g.includes('metal') || g.includes('punk') || g.includes('grunge') || g.includes('alt')) return 'rock';
  if (g.includes('latin') || g.includes('reggaeton') || g.includes('salsa')) return 'latin';
  if (g.includes('folk') || g.includes('country') || g.includes('acoustic') || g.includes('indie')) return 'acoustic';
  if (g.includes('jazz') || g.includes('blues')) return 'jazz';
  if (g.includes('classic') || g.includes('soundtrack') || g.includes('orchestra')) return 'classical';
  if (g.includes('global') || g.includes('world') || g.includes('afro')) return 'global';
  return 'pop';
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function hashPair(a: string, b: string): number {
  const s = `${a}::${b}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 300) / 100; // 0.00 - 2.99
}

export function loadRecommendationState(): RecommendationState {
  if (typeof window === 'undefined') return { ...DEFAULT_RECOMMENDATION_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECOMMENDATION_STATE };
    const parsed = JSON.parse(raw) as Partial<RecommendationState>;
    const migratedRepeat: RepeatMode =
      !parsed.autoplayDefaultApplied && parsed.repeatMode === 'all'
        ? 'off'
        : parsed.repeatMode === 'off' || parsed.repeatMode === 'all' || parsed.repeatMode === 'one'
          ? parsed.repeatMode
          : 'off';
    const loaded: RecommendationState = {
      likedTracks: Array.isArray(parsed.likedTracks) ? parsed.likedTracks.slice(0, 200) : [],
      recentTracks: Array.isArray(parsed.recentTracks) ? parsed.recentTracks.slice(0, 60) : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists.slice(0, 30) : [],
      artistAffinity:
        parsed.artistAffinity && typeof parsed.artistAffinity === 'object' ? parsed.artistAffinity : {},
      genreAffinity:
        parsed.genreAffinity && typeof parsed.genreAffinity === 'object' ? parsed.genreAffinity : {},
      skippedAtByTrackId:
        parsed.skippedAtByTrackId && typeof parsed.skippedAtByTrackId === 'object'
          ? parsed.skippedAtByTrackId
          : {},
      shuffle: Boolean(parsed.shuffle),
      repeatMode: migratedRepeat,
      autoplayDefaultApplied: true,
      playbackRate:
        typeof parsed.playbackRate === 'number' && parsed.playbackRate >= 0.5 && parsed.playbackRate <= 2
          ? parsed.playbackRate
          : 1,
      eqPreset:
        parsed.eqPreset === 'flat' ||
        parsed.eqPreset === 'bass' ||
        parsed.eqPreset === 'vocal' ||
        parsed.eqPreset === 'club' ||
        parsed.eqPreset === 'acoustic'
          ? parsed.eqPreset
          : 'flat',
      crossfadeSeconds:
        typeof parsed.crossfadeSeconds === 'number' && parsed.crossfadeSeconds >= 0 && parsed.crossfadeSeconds <= 10
          ? parsed.crossfadeSeconds
          : 2
    };
    if (!parsed.autoplayDefaultApplied) {
      saveRecommendationState(loaded);
    }
    return loaded;
  } catch {
    return { ...DEFAULT_RECOMMENDATION_STATE };
  }
}

export function saveRecommendationState(state: RecommendationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        likedTracks: state.likedTracks.slice(0, 200),
        recentTracks: state.recentTracks.slice(0, 60),
        playlists: state.playlists.slice(0, 30)
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function recordTrackSignal(
  state: RecommendationState,
  track: Track,
  signal: 'play' | 'complete' | 'earlySkip' | 'toggleLike'
): RecommendationState {
  const artistKey = extractPrimaryArtist(track.artist);
  const genreKey = resolveGenreFamily(track.genre, track.artist);
  const next: RecommendationState = {
    ...state,
    likedTracks: [...state.likedTracks],
    recentTracks: [...state.recentTracks],
    artistAffinity: { ...state.artistAffinity },
    genreAffinity: { ...state.genreAffinity },
    skippedAtByTrackId: { ...state.skippedAtByTrackId }
  };

  if (signal === 'play') {
    next.recentTracks = [track, ...next.recentTracks.filter((t) => t.id !== track.id)].slice(0, 60);
  } else if (signal === 'complete') {
    if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) + 2.5, -10, 15);
    next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) + 1.8, -8, 12);
    delete next.skippedAtByTrackId[track.id];
  } else if (signal === 'earlySkip') {
    if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) - 2.0, -10, 15);
    next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) - 1.0, -8, 12);
    next.skippedAtByTrackId[track.id] = Date.now();
  } else if (signal === 'toggleLike') {
    const exists = next.likedTracks.some((t) => t.id === track.id);
    if (exists) {
      next.likedTracks = next.likedTracks.filter((t) => t.id !== track.id);
      if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) - 3, -10, 15);
    } else {
      next.likedTracks = [track, ...next.likedTracks].slice(0, 200);
      if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) + 4, -10, 15);
      next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) + 2.5, -8, 12);
    }
  }

  saveRecommendationState(next);
  return next;
}

export function scoreCandidateTrack(
  candidate: Track,
  seedTrack: Track,
  recentIdsAndArtists: { ids: string[]; artists: string[] },
  state: RecommendationState,
  mood: MoodPreset = 'all',
  nowMs = Date.now()
): number {
  let score = 0;

  const seedArtist = extractPrimaryArtist(seedTrack.artist);
  const candArtist = extractPrimaryArtist(candidate.artist);
  const seedFamily = resolveGenreFamily(seedTrack.genre, seedTrack.artist);
  const candFamily = resolveGenreFamily(candidate.genre, candidate.artist);
  const seedClass = classifyTrackTier(seedTrack);
  const candClass = classifyTrackTier(candidate);

  // 0. Equivalent Class / Style Tier Matching
  if (candClass.classId === seedClass.classId) {
    score += 58;
  } else if (seedClass.compatibleClasses.includes(candClass.classId)) {
    score += 22;
  } else {
    score -= 48;
  }

  if (seedClass.isInstrumental !== candClass.isInstrumental) {
    score -= 55;
  }

  const seedBaseTitle = normalizeBaseTitle(seedTrack.title);
  const candBaseTitle = normalizeBaseTitle(candidate.title);
  if (seedBaseTitle && candBaseTitle && seedBaseTitle === candBaseTitle) {
    score -= 180;
  }

  // 1. Genre continuity
  if (candidate.genre.toLowerCase() === seedTrack.genre.toLowerCase() && candidate.genre) {
    score += 28;
  } else if (candFamily === seedFamily) {
    score += 20;
  } else if (GENRE_COMPATIBILITY[seedFamily]?.includes(candFamily)) {
    score += 9;
  } else {
    score -= 8;
  }

  // 2. Tempo / BPM transition smoothness
  const seedBpm = seedTrack.bpm > 40 ? seedTrack.bpm : 112;
  const candBpm = candidate.bpm > 40 ? candidate.bpm : 112;
  const bpmDelta = Math.abs(seedBpm - candBpm);
  if (bpmDelta <= 8) score += 20;
  else if (bpmDelta <= 18) score += 14;
  else if (bpmDelta <= 30) score += 6;
  else if (bpmDelta > 50) score -= 14;

  // 3. Artist separation & recency cooldown
  if (candArtist && candArtist === seedArtist) {
    score -= 120;
  }
  const recentArtistIdx = candArtist ? recentIdsAndArtists.artists.indexOf(candArtist) : -1;
  if (recentArtistIdx === 0 || recentArtistIdx === 1) {
    score -= 110;
  } else if (recentArtistIdx >= 2 && recentArtistIdx <= 4) {
    score -= 45;
  }

  const recentIdIdx = recentIdsAndArtists.ids.indexOf(candidate.id);
  if (candidate.id === seedTrack.id) {
    score -= 500;
  } else if (recentIdIdx >= 0 && recentIdIdx < 15) {
    score -= 220;
  } else if (recentIdIdx >= 15) {
    score -= 70;
  }

  // 4. Local user behavioral signals
  const isLiked = state.likedTracks.some((t) => t.id === candidate.id);
  if (isLiked && recentIdIdx === -1) {
    score += 26;
  }
  const artistBias = candArtist ? state.artistAffinity[candArtist] || 0 : 0;
  const genreBias = state.genreAffinity[candFamily] || 0;
  score += clamp(artistBias * 4, -24, 32);
  score += clamp(genreBias * 3, -15, 24);

  const skippedAt = state.skippedAtByTrackId[candidate.id];
  if (skippedAt && nowMs - skippedAt < 20 * 60 * 1000) {
    score -= 95;
  }

  // 5. Mood filter weighting
  if (mood !== 'all') {
    if (mood === 'focus') {
      if (candFamily === 'electronic' || candFamily === 'classical' || candFamily === 'jazz' || candFamily === 'acoustic') score += 26;
      if (candBpm >= 60 && candBpm <= 108) score += 14;
    } else if (mood === 'chill') {
      if (candFamily === 'rnb' || candFamily === 'acoustic' || candFamily === 'jazz' || candFamily === 'indonesian') score += 26;
      if (candBpm <= 108) score += 12;
    } else if (mood === 'upbeat') {
      if (candFamily === 'pop' || candFamily === 'kpop' || candFamily === 'jpop' || candFamily === 'electronic' || candFamily === 'latin') score += 26;
      if (candBpm >= 110) score += 14;
    } else if (mood === 'workout') {
      if (candFamily === 'hiphop' || candFamily === 'electronic' || candFamily === 'rock') score += 28;
      if (candBpm >= 118) score += 16;
    } else if (mood === 'lateNight') {
      if (candFamily === 'rnb' || candFamily === 'jazz' || candFamily === 'indonesian') score += 26;
      if (candBpm <= 108) score += 14;
    } else if (mood === 'party') {
      if (candFamily === 'electronic' || candFamily === 'hiphop' || candFamily === 'pop' || candFamily === 'latin') score += 28;
      if (candBpm >= 118) score += 15;
    } else if (mood === 'romance') {
      if (candFamily === 'rnb' || candFamily === 'acoustic' || candFamily === 'indonesian' || candFamily === 'pop') score += 26;
      if (candBpm >= 60 && candBpm <= 112) score += 12;
    } else if (mood === 'sleep') {
      if (candFamily === 'classical' || candFamily === 'acoustic' || candFamily === 'jazz') score += 30;
      if (candBpm <= 96) score += 16;
    } else if (mood === 'indonesian') {
      if (candFamily === 'indonesian') score += 45;
    } else if (mood === 'classic') {
      if (candFamily === 'rock' || candFamily === 'jazz' || candFamily === 'classical') score += 28;
    } else if (mood === 'acoustic') {
      if (candFamily === 'acoustic' || candFamily === 'jazz' || candFamily === 'classical') score += 32;
      if (candBpm <= 116) score += 10;
    }
  }

  // 6. Duration & playable stream preference
  if (candidate.duration >= 90 && candidate.duration <= 480) score += 4;
  if (candidate.audioUrl || candidate.youtubeId) score += 5;

  // 7. Deterministic tie-breaker
  score += hashPair(seedTrack.id, candidate.id);

  return score;
}

export function buildSmartQueueFromPool(
  seedTrack: Track,
  pool: Track[],
  recentTracks: Track[],
  state: RecommendationState,
  mood: MoodPreset = 'all',
  limit = 25
): Track[] {
  const uniqueMap = new Map<string, Track>();
  for (const t of pool) {
    if (t && t.id && t.id !== seedTrack.id && !uniqueMap.has(t.id)) {
      uniqueMap.set(t.id, t);
    }
  }
  const remaining = Array.from(uniqueMap.values());
  const ordered: Track[] = [];
  const rollingIds = [seedTrack.id, ...recentTracks.slice(0, 12).map((t) => t.id)];
  const rollingArtists = [
    extractPrimaryArtist(seedTrack.artist),
    ...recentTracks.slice(0, 5).map((t) => extractPrimaryArtist(t.artist))
  ];
  let currentSeed = seedTrack;

  while (remaining.length > 0 && ordered.length < limit) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = scoreCandidateTrack(
        remaining[i],
        currentSeed,
        { ids: rollingIds, artists: rollingArtists },
        state,
        mood
      );
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    rollingIds.unshift(chosen.id);
    if (rollingIds.length > 18) rollingIds.pop();
    const chosenArtist = extractPrimaryArtist(chosen.artist);
    if (chosenArtist) {
      rollingArtists.unshift(chosenArtist);
      if (rollingArtists.length > 6) rollingArtists.pop();
    }
    currentSeed = chosen;
  }

  return ordered;
}

export function pickNextTrackPure(params: {
  currentTrack: Track;
  queue: Track[];
  manualQueue: Track[];
  recentTracks: Track[];
  state: RecommendationState;
  mood: MoodPreset;
}): {
  nextTrack: Track;
  consumedManual: boolean;
  shouldRestartCurrent: boolean;
} {
  const { currentTrack, queue, manualQueue, recentTracks, state, mood } = params;

  if (state.repeatMode === 'one') {
    return { nextTrack: currentTrack, consumedManual: false, shouldRestartCurrent: true };
  }

  if (manualQueue.length > 0) {
    return { nextTrack: manualQueue[0], consumedManual: true, shouldRestartCurrent: false };
  }

  const recentIds = [currentTrack.id, ...recentTracks.slice(0, 14).map((t) => t.id)];
  const recentArtists = [
    extractPrimaryArtist(currentTrack.artist),
    ...recentTracks.slice(0, 5).map((t) => extractPrimaryArtist(t.artist))
  ];

  const pool = queue.filter((t) => t.id !== currentTrack.id);
  if (pool.length === 0) {
    return { nextTrack: currentTrack, consumedManual: false, shouldRestartCurrent: true };
  }

  if (state.shuffle) {
    let bestTrack = pool[0];
    let bestScore = -Infinity;
    for (const cand of pool) {
      const s = scoreCandidateTrack(
        cand,
        currentTrack,
        { ids: recentIds, artists: recentArtists },
        state,
        mood
      );
      if (s > bestScore) {
        bestScore = s;
        bestTrack = cand;
      }
    }
    return { nextTrack: bestTrack, consumedManual: false, shouldRestartCurrent: false };
  }

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  if (currentIdx >= 0 && currentIdx + 1 < queue.length) {
    return { nextTrack: queue[currentIdx + 1], consumedManual: false, shouldRestartCurrent: false };
  }

  // End of linear queue: pick highest scored track so playback stays smooth & varied
  let bestWrap = pool[0];
  let bestScore = -Infinity;
  for (const cand of pool) {
    const s = scoreCandidateTrack(
      cand,
      currentTrack,
      { ids: recentIds, artists: recentArtists },
      state,
      mood
    );
    if (s > bestScore) {
      bestScore = s;
      bestWrap = cand;
    }
  }
  return { nextTrack: bestWrap, consumedManual: false, shouldRestartCurrent: false };
}

export function getRelatedArtistsFromDirectory(
  artistName: string,
  genre: string,
  count = 4
): IndexedArtist[] {
  const targetName = extractPrimaryArtist(artistName);
  const targetFamily = resolveGenreFamily(genre, artistName);
  const compatibleFamilies = new Set<GenreFamily>([
    targetFamily,
    ...(GENRE_COMPATIBILITY[targetFamily] || [])
  ]);

  const exactGenreMatches: IndexedArtist[] = [];
  const familyMatches: IndexedArtist[] = [];

  for (const entry of ARTISTS_DIRECTORY) {
    const norm = entry.name.toLowerCase();
    if (norm === targetName) continue;
    const fam = resolveGenreFamily(entry.genre, entry.name);
    if (fam === targetFamily) {
      exactGenreMatches.push(entry);
    } else if (compatibleFamilies.has(fam)) {
      familyMatches.push(entry);
    }
  }

  const combined = exactGenreMatches.length >= count
    ? exactGenreMatches
    : [...exactGenreMatches, ...familyMatches];

  if (combined.length === 0) return ARTISTS_DIRECTORY.slice(0, count);

  const seedHash = Math.floor(hashPair(artistName, genre) * 100);
  const picked: IndexedArtist[] = [];
  const step = Math.max(1, Math.floor(combined.length / count));
  for (let i = 0; i < count && i < combined.length; i++) {
    const idx = (seedHash + i * step) % combined.length;
    if (!picked.some((p) => p.name === combined[idx].name)) {
      picked.push(combined[idx]);
    }
  }
  return picked;
}

export function getClassMatchedSeedQueries(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'>,
  mood: MoodPreset = 'all',
  count = 4
): string[] {
  const seedPrimary = extractPrimaryArtist(track.artist);
  const classProfile = classifyTrackTier(track);

  const peerPool = classProfile.peerArtists.filter(
    (name) => name.toLowerCase() !== seedPrimary && !seedPrimary.includes(name.toLowerCase())
  );

  const directorySameClass = ARTISTS_DIRECTORY.filter((entry) => {
    const norm = entry.name.toLowerCase();
    if (norm === seedPrimary || peerPool.some((p) => p.toLowerCase() === norm)) return false;
    return classifyTrackTier({ title: '', artist: entry.name, genre: entry.genre, bpm: track.bpm }).classId === classProfile.classId;
  }).map((e) => e.name);

  const moodQueries = mood !== 'all' ? getMoodSeedQueries(mood) : [];
  const seedHash = Math.floor(hashPair(track.artist || 'artist', track.title || 'title') * 100);

  const combined = Array.from(new Set(peerPool));
  const result: string[] = [];

  if (mood !== 'all' && moodQueries.length > 0) {
    result.push(moodQueries[seedHash % moodQueries.length]);
  }

  const pickRotated = (list: string[]) => {
    if (list.length === 0) return;
    const step = list.length > count ? Math.max(1, Math.floor(list.length / Math.max(1, count))) : 1;
    for (let i = 0; i < list.length && result.length < count; i++) {
      const candidate = list[(seedHash + i * step) % list.length];
      if (!result.includes(candidate)) {
        result.push(candidate);
      }
    }
  };

  pickRotated(combined);
  if (result.length < count) {
    pickRotated(directorySameClass);
  }

  if (result.length < count) {
    const fallback = getRelatedArtistsFromDirectory(track.artist, track.genre, count);
    for (const f of fallback) {
      if (result.length >= count) break;
      if (!result.includes(f.name) && f.name.toLowerCase() !== seedPrimary) {
        result.push(f.name);
      }
    }
  }

  return result.slice(0, count);
}

export function getMoodSeedQueries(mood: MoodPreset): string[] {
  switch (mood) {
    case 'focus':
      return ['Yiruma', 'Ludovico Einaudi', 'Daft Punk Instrumental', 'Max Richter'];
    case 'chill':
      return ['Frank Ocean', 'Daniel Caesar', 'Lauv', 'NIKI'];
    case 'upbeat':
      return ['Dua Lipa', 'The Weeknd', 'Bruno Mars', 'YOASOBI'];
    case 'workout':
      return ['Eminem', 'Kendrick Lamar', 'Imagine Dragons', 'David Guetta'];
    case 'lateNight':
      return ['The Weeknd', 'Hindia', 'NIKI', 'Joji'];
    case 'party':
      return ['Calvin Harris', 'Dua Lipa', 'BLACKPINK', 'Pitbull'];
    case 'romance':
      return ['Tulus', 'Adele', 'Billie Eilish', 'Mahalini'];
    case 'sleep':
      return ['Max Richter', 'Yiruma', 'Olafur Arnalds', 'Debussy'];
    case 'indonesian':
      return ['Tulus', 'NOAH', 'Sheila On 7', 'Raisa'];
    case 'classic':
      return ['Queen', 'Fleetwood Mac', 'The Beatles', 'Michael Jackson'];
    case 'acoustic':
      return ['Ed Sheeran', 'John Mayer', 'Laufey', 'Bon Iver'];
    default:
      return ['The Weeknd', 'Taylor Swift', 'Coldplay', 'Tulus'];
  }
}

export type LyricCardTheme = 'nocturne' | 'emerald' | 'daylight';

const LYRIC_THEME_STYLES: Record<
  LyricCardTheme,
  {
    bgStops: [string, string, string];
    glow: string;
    titleColor: string;
    artistColor: string;
    lyricColor: string;
    subLyricColor: string;
    accentColor: string;
    divider: string;
    artFallbackBg: string;
  }
> = {
  nocturne: {
    bgStops: ['#0C1412', '#07090F', '#04060A'],
    glow: 'rgba(16, 185, 129, 0.22)',
    titleColor: '#F8FAFC',
    artistColor: '#94A3B8',
    lyricColor: '#FFFFFF',
    subLyricColor: '#94A3B8',
    accentColor: '#10B981',
    divider: 'rgba(255, 255, 255, 0.08)',
    artFallbackBg: '#111926'
  },
  emerald: {
    bgStops: ['#052E24', '#064E3B', '#04221C'],
    glow: 'rgba(52, 211, 153, 0.28)',
    titleColor: '#ECFDF5',
    artistColor: '#A7F3D0',
    lyricColor: '#FFFFFF',
    subLyricColor: '#A7F3D0',
    accentColor: '#6EE7B7',
    divider: 'rgba(255, 255, 255, 0.14)',
    artFallbackBg: '#065F46'
  },
  daylight: {
    bgStops: ['#FAF7F2', '#F3EEE5', '#EAE2D6'],
    glow: 'rgba(16, 185, 129, 0.14)',
    titleColor: '#0F172A',
    artistColor: '#475569',
    lyricColor: '#090D16',
    subLyricColor: '#475569',
    accentColor: '#047857',
    divider: 'rgba(15, 23, 42, 0.10)',
    artFallbackBg: '#E2E8F0'
  }
};

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderLyricCardCanvas(
  track: Track,
  selectedLines: LyricLine[],
  theme: LyricCardTheme = 'nocturne',
  targetCanvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  const width = 1080;
  const height = 1350;
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = LYRIC_THEME_STYLES[theme] || LYRIC_THEME_STYLES.nocturne;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, palette.bgStops[0]);
  bgGrad.addColorStop(0.5, palette.bgStops[1]);
  bgGrad.addColorStop(1, palette.bgStops[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.25,
    height * 0.22,
    40,
    width * 0.25,
    height * 0.22,
    640
  );
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const artSize = 180;
  const artX = 96;
  const artY = 108;
  let drewArtwork = false;
  if (track.coverUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        const timer = window.setTimeout(() => reject(new Error('Image timeout')), 3500);
        image.onload = () => {
          window.clearTimeout(timer);
          resolve(image);
        };
        image.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('Image load failed'));
        };
        image.src = track.coverUrl;
      });
      ctx.save();
      drawRoundedRectPath(ctx, artX, artY, artSize, artSize, 24);
      ctx.clip();
      ctx.drawImage(img, artX, artY, artSize, artSize);
      ctx.restore();
      drewArtwork = true;
    } catch {
      drewArtwork = false;
    }
  }

  if (!drewArtwork) {
    ctx.fillStyle = palette.artFallbackBg;
    drawRoundedRectPath(ctx, artX, artY, artSize, artSize, 24);
    ctx.fill();
    ctx.fillStyle = palette.accentColor;
    ctx.font = '700 64px "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText((track.title || 'S').slice(0, 2).toUpperCase(), artX + 48, artY + artSize / 2);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.titleColor;
  ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
  const titleText = (track.title || 'Unknown Track').slice(0, 28);
  ctx.fillText(titleText, artX + artSize + 36, artY + 76);

  ctx.fillStyle = palette.artistColor;
  ctx.font = '500 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText((track.artist || 'Unknown Artist').slice(0, 34), artX + artSize + 36, artY + 126);

  ctx.fillStyle = palette.accentColor;
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText((track.genre || 'Music').toUpperCase(), artX + artSize + 36, artY + 168);

  ctx.strokeStyle = palette.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 356);
  ctx.lineTo(width - 96, 356);
  ctx.stroke();

  const wrapLines = (text: string, maxWidth: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const validLines = selectedLines.filter((l) => Boolean(l?.text?.trim())).slice(0, 4);
  const mainLinesText =
    validLines.length > 0
      ? validLines.map((l) => l.text.trim())
      : [`${track.title} — ${track.artist}`];
  const secondaryText =
    validLines.length === 1 ? validLines[0].translation?.trim() || '' : '';

  const lineCount = mainLinesText.length;
  const fontSize = lineCount >= 3 ? 46 : 56;
  const lineAdvance = lineCount >= 3 ? 64 : 76;
  const mainFont = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

  let y = lineCount >= 3 ? 470 : 510;
  ctx.fillStyle = palette.lyricColor;
  ctx.font = mainFont;

  for (const quoteLine of mainLinesText) {
    const wrapped = wrapLines(quoteLine, width - 192, mainFont).slice(0, 3);
    for (const wLine of wrapped) {
      if (y > height - 210) break;
      ctx.fillText(wLine, 96, y);
      y += lineAdvance;
    }
    y += 18;
  }

  if (secondaryText && y < height - 180) {
    y += 14;
    const subFont = '500 32px "Plus Jakarta Sans", sans-serif';
    const wrappedSub = wrapLines(secondaryText, width - 192, subFont).slice(0, 3);
    ctx.fillStyle = palette.subLyricColor;
    ctx.font = subFont;
    for (const line of wrappedSub) {
      ctx.fillText(line, 96, y);
      y += 44;
    }
  }

  ctx.fillStyle = palette.accentColor;
  ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SONACAST', 96, height - 96);

  ctx.fillStyle = palette.artistColor;
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText((track.album || 'Studio Release').slice(0, 38), 270, height - 96);

  return canvas;
}

export async function exportLyricQuotePng(
  track: Track,
  activeLine: LyricLine | null,
  nextLine?: LyricLine | null,
  theme: LyricCardTheme = 'nocturne',
  customLines?: LyricLine[]
): Promise<boolean> {
  const chosenLines =
    customLines && customLines.length > 0
      ? customLines
      : [activeLine, nextLine].filter((item): item is LyricLine => Boolean(item && item.text.trim()));

  const canvas = await renderLyricCardCanvas(track, chosenLines, theme);
  if (!canvas) return false;

  try {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const safeName = (track.title || 'sonacast-lyric')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    a.href = dataUrl;
    a.download = `${safeName || 'sonacast'}-lyric-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

