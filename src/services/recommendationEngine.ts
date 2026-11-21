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
  | 'indo_timur_hits'
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

export const SONIC_CLASS_PROFILES: Record<SonicClassId, SonicClassProfile> = {
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
  indo_timur_hits: {
    classId: 'indo_timur_hits',
    classLabel: 'Indo Timur & Eastern Pop',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_indie_folk'],
    peerArtists: [
      'Near', 'Dian Sorowea', 'Dandy Barakati', 'Silet Open Up', 'Juan Reza',
      'Wizz Baker', 'Fresly Nikijuluw', 'Toton Caribo', 'Mace Purba', 'Jacson Zeran',
      'Justy Aldrin', 'Vicky Salamor', 'Mario G Klau', 'Gihon Marel', 'Ecko Show',
      'Raim Laode', 'Chesylino', 'Gery Gany', 'M.A.C', 'Shine Of Black'
    ],
    keywords: [
      'near', 'dian sorowea', 'dandy barakati', 'silet open up', 'juan reza',
      'wizz baker', 'fresly nikijuluw', 'toton caribo', 'mace purba', 'jacson zeran',
      'jecson zeran', 'justy aldrin', 'vicky salamor', 'mario g klau', 'gihon marel',
      'ecko show', 'raim laode', 'chesylino', 'gery gany', 'shine of black',
      'ona hetharua', 'mitha talahatu', 'glenn sebastian', 'doddie latuharhary',
      'yochen amos', 'whllyano', 'nyong franco', 'dj qhelfin', 'sanjay', 'marvey kaya',
      'aldy maldini', 'faris adam', 'tenxi', 'naykilla', 'jemsii', 'm.a.c', 'mac papua',
      'timur', 'ambon', 'papua', 'kupang', 'manado', 'ntt'
    ]
  },
  indo_pop_ballad: {
    classId: 'indo_pop_ballad',
    classLabel: 'Indo Pop & Ballad Soul',
    isInstrumental: false,
    compatibleClasses: ['indo_timur_hits', 'indo_band_rock', 'indo_indie_folk'],
    peerArtists: ['Tulus', 'Raisa', 'Mahalini', 'Bernadya', 'Tiara Andini', 'Nadin Amizah', 'Andmesh', 'Afgan', 'Judika', 'Lyodra'],
    keywords: [
      'tulus', 'raisa', 'afgan', 'glenn fredly', 'judika', 'mahalini', 'tiara andini',
      'lyodra', 'ziva magnolya', 'bernadya', 'nadin amizah', 'pamungkas', 'rizky febian',
      'juicy luicy', 'virgoun', 'budi doremi', 'rossa', 'bunga citra lestari',
      'isyana sarasvati', 'yura yunita', 'sal priadi', 'siti nurhaliza', 'maher zain',
      'andmesh', 'jaz', 'cakra khan', 'fabio asher', 'anggi marito',
      'keisya levronka', 'nyoman paul', 'rony parulian', 'aziz hedra', 'brisia jodie',
      'stevan pasaribu', 'mahen', 'anji', 'marcell', 'krisdayanti', 'melly goeslaw'
    ]
  },
  indo_band_rock: {
    classId: 'indo_band_rock',
    classLabel: 'Indo Band & Pop Rock',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_indie_folk', 'indo_timur_hits'],
    peerArtists: ['Sheila On 7', 'Dewa 19', 'Noah', 'Padi', 'Peterpan', 'Gigi', 'Ada Band', 'Chrisye', 'Nidji'],
    keywords: [
      'dewa 19', 'sheila on 7', 'noah', 'peterpan', 'padi', 'gigi', 'ada band', 'chrisye',
      'ungu', 'nidji', 'd\'masiv', 'letto', 'slank', 'armada', 'seventeen', 'kahitna',
      'yovie', 'vierratale', 'vierra', 'geisha', 'for revenge', 'last child', 'samsons',
      'kotak', 'kerispatih', 'naff', 'drive', 'ran', 'hivi', 'maliq'
    ]
  },
  indo_indie_folk: {
    classId: 'indo_indie_folk',
    classLabel: 'Indo Indie & Folk',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_band_rock', 'indo_timur_hits'],
    peerArtists: ['Hindia', 'Payung Teduh', 'Fourtwnty', 'Efek Rumah Kaca', 'Reality Club', 'Banda Neira', 'Feby Putri', 'Kunto Aji'],
    keywords: ['hindia', 'feast', 'efek rumah kaca', 'payung teduh', 'fourtwnty', 'banda neira', 'reality club', 'barasuara', 'feby putri', 'kunto aji', 'fiersa besari', 'dere', 'idgitaf', 'iwan fals', 'danilla', 'dialog dini hari', 'stars and rabbit']
  },
  indo_koplo_dangdut: {
    classId: 'indo_koplo_dangdut',
    classLabel: 'Indo Dangdut & Koplo',
    isInstrumental: false,
    compatibleClasses: ['indo_band_rock', 'indo_timur_hits'],
    peerArtists: ['Denny Caknan', 'Happy Asmara', 'Guyon Waton', 'NDX A.K.A.', 'Wali', 'Didi Kempot'],
    keywords: ['denny caknan', 'happy asmara', 'ndx', 'guyon waton', 'wali', 'kangen band', 'st12', 'didi kempot', 'rhoma irama', 'muslih fvnky', 'masdddho', 'ndarboy', 'aftershine', 'wahyu']
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
    compatibleClasses: ['rnb_late_soul', 'electronic_dance_synth', 'kpop_idol'],
    peerArtists: ['Taylor Swift', 'Dua Lipa', 'Ariana Grande', 'Billie Eilish', 'Bruno Mars', 'Ed Sheeran', 'Harry Styles', 'Sabrina Carpenter', 'Olivia Rodrigo'],
    keywords: ['taylor swift', 'dua lipa', 'ariana grande', 'billie eilish', 'olivia rodrigo', 'sabrina carpenter', 'harry styles', 'bruno mars', 'ed sheeran', 'justin bieber', 'shawn mendes', 'charlie puth', 'benson boone', 'teddy swims', 'chappell roan', 'adele', 'sam smith', 'maroon 5', 'lady gaga', 'rihanna', 'katy perry', 'tate mcrae', 'charli xcx', 'gracie abrams', 'troye sivan', 'clairo', 'lana del rey']
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
    compatibleClasses: ['kpop_idol', 'modern_chart_pop', 'electronic_dance_synth'],
    peerArtists: ['YOASOBI', 'Kenshi Yonezu', 'Fujii Kaze', 'Official HIGE DANDism', 'Ado', 'Vaundy', 'Yorushika', 'Aimer'],
    keywords: ['yoasobi', 'kenshi yonezu', 'fujii kaze', 'ado', 'official hige', 'king gnu', 'yorushika', 'vaundy', 'mrs. green apple', 'one ok rock', 'radwimps', 'lisa', 'aimer', 'mariya takeuchi', 'miki matsubara', 'tatsuro yamashita', 'hikaru utada', 'creepy nuts', 'imase']
  },
  alt_indie_rock: {
    classId: 'alt_indie_rock',
    classLabel: 'Alternative & Indie Rock',
    isInstrumental: false,
    compatibleClasses: ['classic_global_legend'],
    peerArtists: ['Coldplay', 'Arctic Monkeys', 'Radiohead', 'Muse', 'Oasis', 'Imagine Dragons', 'OneRepublic', 'Linkin Park'],
    keywords: ['coldplay', 'arctic monkeys', 'radiohead', 'muse', 'oasis', 'imagine dragons', 'onerepublic', 'linkin park', 'nirvana', 'foo fighters', 'green day', 'red hot chili peppers', 'the killers', 'vampire weekend', 'the clash', 'paramore', 'evanescence']
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
    classLabel: 'Synth-Pop, Electronic & Indie Dance',
    isInstrumental: false,
    compatibleClasses: ['modern_chart_pop', 'kpop_idol', 'jpop_city_anime', 'rnb_late_soul'],
    peerArtists: ['Tame Impala', 'Daft Punk', 'Calvin Harris', 'Kygo', 'Avicii', 'Fred again..', 'Disclosure', 'The 1975', 'MGMT'],
    keywords: ['tame impala', 'daft punk', 'calvin harris', 'david guetta', 'avicii', 'martin garrix', 'kygo', 'zedd', 'alan walker', 'fred again', 'disclosure', 'peggy gou', 'odesza', 'flume', 'm83', 'skrillex', 'the chainsmokers', 'marshmello', 'tiesto', 'armin van buuren', 'deadmau5', 'justice', 'kavinsky', 'the 1975', 'foster the people', 'mgmt', 'empire of the sun', 'phoenix', 'the neighbourhood', 'cigarettes after sex', 'mac demarco']
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

export type TrackLanguageRegion = 'id' | 'ko' | 'ja' | 'es' | 'en' | 'instrumental';

export interface AudioFeatureVector {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tempoNorm: number;
}

const TIMUR_TITLE_CUES =
  /\b(karna su sayang|tabola bale|mode pesawat|bale pulang|sa stop|sa sayang|sa tra|ko tra|trada|jang ganggu|kaka main salah|aduh mamae|nona ambon|nona papua|ste cu|stecu|pica pica|garam dan madu|par ale|deng dia|so bilang|su tunggu|beta rindu|beta sayang|ale pung|pigi jo|bintang trada|mama su tunggu|hits timur|lagu timur|rindu timur|orang timur)\b/i;

const INDONESIAN_TITLE_CUES =
  /\b(sayang|cinta|rindu|hati|kenangan|kisah|tertawan|trakan|mendua|dirimu|sialnya|sempurna|kasih|separuh|monokrom|tujuh belas|berdua|bertahan|menunggu|selamanya|karena|jangan|terlalu|karna|jang|komang|tak segampang itu|sisa rasa|hilang tanpa bilang|tak ingin usai|pesan terakhir|penjaga hati|semata karenamu|berhenti berharap|seluruh nafas|cukup tahu|dan\.\.\.|kangen|negoro|angin|mendung|rungkad|ojo|lali|saliva|gomu|pulang|pesawat|bale|tabola|trada|nona|mamae|selow|laskar|pelangi|menangis|sial|satu bulan|mati-matian|berjalan|terlintas|bintang|senja|pelukan)\b/i;

const RECOGNIZED_ARTIST_SET: Set<string> = (() => {
  const set = new Set<string>();
  for (const entry of ARTISTS_DIRECTORY) {
    const clean = entry.name.toLowerCase().trim();
    if (clean) set.add(clean);
  }
  for (const profile of Object.values(SONIC_CLASS_PROFILES)) {
    for (const p of profile.peerArtists) set.add(p.toLowerCase().trim());
    for (const kw of profile.keywords) set.add(kw.toLowerCase().trim());
  }
  return set;
})();

export function isRecognizedCatalogArtist(
  track: Pick<Track, 'artist'>
): boolean {
  const primary = extractPrimaryArtist(track.artist);
  if (!primary) return false;
  if (RECOGNIZED_ARTIST_SET.has(primary)) return true;
  for (const known of RECOGNIZED_ARTIST_SET) {
    if (known.length >= 4 && isWordBoundaryMatch(primary, known)) {
      return true;
    }
  }
  return false;
}

function isWordBoundaryMatch(haystack: string, keyword: string): boolean {
  if (!keyword || !haystack) return false;
  if (keyword.length <= 4 && !keyword.includes(' ')) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
  }
  return haystack.includes(keyword);
}

export function normalizeBaseTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(live|remix|remaster(?:ed)?|acoustic|slowed|reverb|sped up|cover|version|edit|radio|official|audio)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferTrackLanguageRegion(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'>
): TrackLanguageRegion {
  const titleLower = String(track.title || '').toLowerCase();
  const artistLower = String(track.artist || '').toLowerCase();
  const genreLower = String(track.genre || '').toLowerCase();

  if (
    genreLower.includes('classical') ||
    genreLower.includes('neoclassical') ||
    genreLower.includes('soundtrack') ||
    genreLower.includes('orchestra') ||
    /\b(nocturne|sonata|concerto|prelude|etude|piano solo|symphony|opus|instrumental)\b/i.test(titleLower)
  ) {
    return 'instrumental';
  }
  if (
    genreLower.includes('indonesia') ||
    genreLower.includes('indo') ||
    genreLower.includes('dangdut') ||
    genreLower.includes('koplo') ||
    genreLower.includes('timur') ||
    TIMUR_TITLE_CUES.test(titleLower) ||
    INDONESIAN_TITLE_CUES.test(titleLower) ||
    ['indo_timur_hits', 'indo_pop_ballad', 'indo_band_rock', 'indo_indie_folk', 'indo_koplo_dangdut'].some((cid) =>
      SONIC_CLASS_PROFILES[cid as SonicClassId].keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
    )
  ) {
    return 'id';
  }
  if (
    genreLower.includes('k-pop') ||
    genreLower.includes('kpop') ||
    genreLower.includes('korean') ||
    /[\uAC00-\uD7AF]/.test(track.title || '') ||
    SONIC_CLASS_PROFILES.kpop_idol.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
  ) {
    return 'ko';
  }
  if (
    genreLower.includes('j-pop') ||
    genreLower.includes('jpop') ||
    genreLower.includes('anime') ||
    genreLower.includes('city pop') ||
    /[\u3040-\u30FF\u4E00-\u9FAF]/.test(track.title || '') ||
    SONIC_CLASS_PROFILES.jpop_city_anime.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
  ) {
    return 'ja';
  }
  if (
    genreLower.includes('latin') ||
    genreLower.includes('reggaeton') ||
    SONIC_CLASS_PROFILES.latin_global.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
  ) {
    return 'es';
  }
  return 'en';
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
    if (profile.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))) {
      return profile;
    }
  }

  // Catch Eastern Indonesian (Lagu Timur) tracks explicitly before generic pop/hip-hop rules
  if (TIMUR_TITLE_CUES.test(titleLower) || genreLower.includes('timur')) {
    return SONIC_CLASS_PROFILES.indo_timur_hits;
  }

  // Catch Indonesian / Malay titles with generic 'Pop' genre metadata (e.g. Karna Su Sayang, Komang, Sial)
  if (INDONESIAN_TITLE_CUES.test(titleLower)) {
    if (genreLower.includes('indie') || genreLower.includes('folk')) return SONIC_CLASS_PROFILES.indo_indie_folk;
    if (genreLower.includes('rock') || genreLower.includes('band')) return SONIC_CLASS_PROFILES.indo_band_rock;
    return SONIC_CLASS_PROFILES.indo_pop_ballad;
  }

  const family = resolveGenreFamily(genreLower, artistLower, titleLower);
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

export function resolveGenreFamily(genre: string, artist = '', title = ''): GenreFamily {
  const g = String(genre || '').toLowerCase();
  const a = String(artist || '').toLowerCase();
  const t = String(title || '').toLowerCase();

  if (
    g.includes('indonesia') ||
    g.includes('indo') ||
    g.includes('dangdut') ||
    g.includes('koplo') ||
    INDONESIAN_TITLE_CUES.test(t) ||
    [
      'tulus', 'noah', 'sheila on 7', 'raisa', 'dewa 19', 'isyana', 'nadin amizah', 'mahalini',
      'tiara andini', 'judika', 'rossa', 'peterpan', 'slank', 'iwan fals', 'pamungkas', 'hindia',
      'feast', 'barasuara', 'efek rumah kaca', 'payung teduh', 'fourtwnty', 'kunto aji',
      'rizky febian', 'ziva magnolya', 'lyodra', 'virgoun', 'budi doremi', 'wali', 'ungu',
      'st12', 'kangen band', 'raffa affar', 'denny caknan', 'happy asmara', 'bernadya',
      'sal priadi', 'juicy luicy', 'near', 'dian sorowea', 'wizz baker', 'juan reza',
      'chesylino', 'raim laode', 'andmesh', 'mario g klau', 'for revenge', 'last child',
      'vierratale', 'geisha', 'fabio asher', 'anggi marito', 'keisya levronka', 'nyoman paul',
      'cakra khan', 'jaz', 'd\'masiv', 'ada band', 'kahitna', 'maliq', 'hivi'
    ].some((k) => isWordBoundaryMatch(a, k))
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
  if (g.includes('classical') || g.includes('neoclassical') || g.includes('soundtrack') || g.includes('orchestra')) return 'classical';
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

export function estimateAudioFeatures(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'>
): AudioFeatureVector {
  const cls = classifyTrackTier(track).classId;
  const bpm = track.bpm > 40 ? track.bpm : 112;
  const titleLower = String(track.title || '').toLowerCase();
  const genreLower = String(track.genre || '').toLowerCase();
  const tempoNorm = clamp((bpm - 50) / 130, 0, 1);

  let base: Omit<AudioFeatureVector, 'tempoNorm'>;
  switch (cls) {
    case 'piano_neoclassical':
      base = { energy: 0.18, valence: 0.34, danceability: 0.22, acousticness: 0.94, instrumentalness: 0.95 };
      break;
    case 'soundtrack_epic':
      base = { energy: 0.62, valence: 0.42, danceability: 0.30, acousticness: 0.55, instrumentalness: 0.88 };
      break;
    case 'indo_timur_hits':
      base = { energy: 0.72, valence: 0.68, danceability: 0.80, acousticness: 0.28, instrumentalness: 0.02 };
      break;
    case 'indo_pop_ballad':
      base = { energy: 0.44, valence: 0.38, danceability: 0.52, acousticness: 0.62, instrumentalness: 0.02 };
      break;
    case 'indo_indie_folk':
      base = { energy: 0.48, valence: 0.42, danceability: 0.54, acousticness: 0.68, instrumentalness: 0.04 };
      break;
    case 'indo_band_rock':
      base = { energy: 0.72, valence: 0.54, danceability: 0.58, acousticness: 0.24, instrumentalness: 0.04 };
      break;
    case 'indo_koplo_dangdut':
      base = { energy: 0.82, valence: 0.76, danceability: 0.84, acousticness: 0.25, instrumentalness: 0.02 };
      break;
    case 'rnb_late_soul':
      base = { energy: 0.50, valence: 0.40, danceability: 0.68, acousticness: 0.38, instrumentalness: 0.05 };
      break;
    case 'classic_global_legend':
      base = { energy: 0.66, valence: 0.62, danceability: 0.60, acousticness: 0.34, instrumentalness: 0.06 };
      break;
    case 'modern_chart_pop':
      base = { energy: 0.74, valence: 0.64, danceability: 0.76, acousticness: 0.18, instrumentalness: 0.02 };
      break;
    case 'kpop_idol':
      base = { energy: 0.82, valence: 0.72, danceability: 0.82, acousticness: 0.10, instrumentalness: 0.02 };
      break;
    case 'jpop_city_anime':
      base = { energy: 0.80, valence: 0.68, danceability: 0.70, acousticness: 0.14, instrumentalness: 0.04 };
      break;
    case 'alt_indie_rock':
      base = { energy: 0.66, valence: 0.44, danceability: 0.52, acousticness: 0.28, instrumentalness: 0.08 };
      break;
    case 'heavy_metal_hard':
      base = { energy: 0.92, valence: 0.38, danceability: 0.42, acousticness: 0.05, instrumentalness: 0.12 };
      break;
    case 'electronic_dance_synth':
      base = { energy: 0.84, valence: 0.64, danceability: 0.84, acousticness: 0.08, instrumentalness: 0.28 };
      break;
    case 'hiphop_rap_trap':
      base = { energy: 0.74, valence: 0.52, danceability: 0.82, acousticness: 0.14, instrumentalness: 0.02 };
      break;
    case 'jazz_blues_acoustic':
      base = { energy: 0.36, valence: 0.50, danceability: 0.50, acousticness: 0.80, instrumentalness: 0.20 };
      break;
    case 'latin_global':
    default:
      base = { energy: 0.78, valence: 0.78, danceability: 0.86, acousticness: 0.20, instrumentalness: 0.02 };
      break;
  }

  let { energy, valence, danceability, acousticness, instrumentalness } = base;
  if (/\b(acoustic|unplugged|ballad|piano|slowed)\b/.test(titleLower) || genreLower.includes('acoustic')) {
    energy = clamp(energy - 0.18, 0.05, 0.98);
    acousticness = clamp(acousticness + 0.25, 0.05, 0.98);
  }
  if (/\b(remix|club|dance|party|sped up)\b/.test(titleLower) || genreLower.includes('dance')) {
    energy = clamp(energy + 0.15, 0.05, 0.98);
    danceability = clamp(danceability + 0.14, 0.05, 0.98);
    acousticness = clamp(acousticness - 0.14, 0.02, 0.95);
  }
  if (/\b(instrumental|karaoke)\b/.test(titleLower)) {
    instrumentalness = Math.max(instrumentalness, 0.85);
  }

  return { energy, valence, danceability, acousticness, instrumentalness, tempoNorm };
}

export function computeAudioVectorCosine(a: AudioFeatureVector, b: AudioFeatureVector): number {
  const va = [a.energy, a.valence, a.danceability, a.acousticness, a.instrumentalness, a.tempoNorm];
  const vb = [b.energy, b.valence, b.danceability, b.acousticness, b.instrumentalness, b.tempoNorm];
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    magA += va[i] * va[i];
    magB += vb[i] * vb[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return clamp(dot / (Math.sqrt(magA) * Math.sqrt(magB)), 0, 1);
}

function inferEraBucket(track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'>): 'classic' | 'modern' {
  const cls = classifyTrackTier(track).classId;
  const artistLower = String(track.artist || '').toLowerCase();
  if (
    cls === 'classic_global_legend' ||
    cls === 'piano_neoclassical' ||
    ['dewa 19', 'sheila on 7', 'chrisye', 'padi', 'iwan fals', 'slank', 'peterpan'].some((kw) =>
      artistLower.includes(kw)
    )
  ) {
    return 'classic';
  }
  return 'modern';
}

export function recordTrackSignal(
  state: RecommendationState,
  track: Track,
  signal: 'play' | 'complete' | 'earlySkip' | 'toggleLike' | 'queueAdd' | 'albumSave'
): RecommendationState {
  const artistKey = extractPrimaryArtist(track.artist);
  const genreKey = resolveGenreFamily(track.genre, track.artist, track.title);
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
  } else if (signal === 'queueAdd' || signal === 'albumSave') {
    const boostArtist = signal === 'albumSave' ? 3.5 : 3.0;
    const boostGenre = signal === 'albumSave' ? 2.2 : 1.8;
    if (artistKey) next.artistAffinity[artistKey] = clamp((next.artistAffinity[artistKey] || 0) + boostArtist, -10, 15);
    next.genreAffinity[genreKey] = clamp((next.genreAffinity[genreKey] || 0) + boostGenre, -8, 12);
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
  nowMs = Date.now(),
  usedBaseTitles?: Set<string>
): number {
  let score = 0;

  const seedArtist = extractPrimaryArtist(seedTrack.artist);
  const candArtist = extractPrimaryArtist(candidate.artist);
  const seedFamily = resolveGenreFamily(seedTrack.genre, seedTrack.artist, seedTrack.title);
  const candFamily = resolveGenreFamily(candidate.genre, candidate.artist, candidate.title);
  const seedClass = classifyTrackTier(seedTrack);
  const candClass = classifyTrackTier(candidate);
  const seedLang = inferTrackLanguageRegion(seedTrack);
  const candLang = inferTrackLanguageRegion(candidate);

  // 0. Equivalent Sonic Class / Style Tier Matching & Spotify Peer-Artist Graph
  if (candClass.classId === seedClass.classId) {
    score += 62;
  } else if (seedClass.compatibleClasses.includes(candClass.classId)) {
    score += 24;
  } else {
    score -= 48;
  }

  if (seedClass.isInstrumental !== candClass.isInstrumental) {
    score -= 60;
  }

  if (
    candArtist &&
    seedClass.peerArtists.some((peer) => {
      const p = peer.toLowerCase();
      return candArtist === p || isWordBoundaryMatch(candArtist, p);
    })
  ) {
    score += 42;
  } else if (isRecognizedCatalogArtist(candidate)) {
    score += 22;
  } else if (mood === 'all' && candArtist !== seedArtist) {
    score -= 110;
  }

  // 0b. Language / Market Coherence (prevents Indonesian Timur <-> US Pop drift while respecting explicit multi-lingual listeners)
  if (seedLang === candLang) {
    score += seedLang === 'en' ? 16 : 36;
  } else if (seedLang !== 'en' && seedLang !== 'instrumental') {
    const userBridgesLanguage = (state.genreAffinity[candFamily] || 0) >= 4;
    score -= userBridgesLanguage ? 18 : 75;
  } else if (seedLang === 'en' && candLang !== 'en' && candLang !== 'instrumental') {
    const userPrefersRegion = (state.genreAffinity[candFamily] || 0) >= 4;
    score -= userPrefersRegion ? 14 : 75;
  }

  const seedBaseTitle = normalizeBaseTitle(seedTrack.title);
  const candBaseTitle = normalizeBaseTitle(candidate.title);
  if ((seedBaseTitle && candBaseTitle && seedBaseTitle === candBaseTitle) || (candBaseTitle && usedBaseTitles?.has(candBaseTitle))) {
    score -= 320;
  }

  // 1. Genre continuity
  if (candidate.genre.toLowerCase() === seedTrack.genre.toLowerCase() && candidate.genre) {
    score += 24;
  } else if (candFamily === seedFamily) {
    score += 18;
  } else if (GENRE_COMPATIBILITY[seedFamily]?.includes(candFamily)) {
    score += 8;
  } else {
    score -= 10;
  }

  // 2. Spotify 6D Audio Feature Vector Cosine Similarity + Tempo + Era
  const seedVec = estimateAudioFeatures(seedTrack);
  const candVec = estimateAudioFeatures(candidate);
  const vecSim = computeAudioVectorCosine(seedVec, candVec);
  score += clamp(Math.round((vecSim - 0.72) * 110), -26, 34);

  const seedBpm = seedTrack.bpm > 40 ? seedTrack.bpm : 112;
  const candBpm = candidate.bpm > 40 ? candidate.bpm : 112;
  const bpmDelta = Math.abs(seedBpm - candBpm);
  if (bpmDelta <= 8) score += 14;
  else if (bpmDelta <= 18) score += 9;
  else if (bpmDelta <= 30) score += 3;
  else if (bpmDelta > 50) score -= 12;

  if (inferEraBucket(seedTrack) === inferEraBucket(candidate)) {
    score += 10;
  }

  // 3. Artist separation & recency cooldown
  if (candArtist && candArtist === seedArtist) {
    score -= 140;
  }
  const recentArtistIdx = candArtist ? recentIdsAndArtists.artists.indexOf(candArtist) : -1;
  if (recentArtistIdx === 0 || recentArtistIdx === 1 || recentArtistIdx === 2) {
    score -= 140;
  } else if (recentArtistIdx >= 3 && recentArtistIdx <= 5) {
    score -= 55;
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
    score += 24;
  }
  const artistBias = candArtist ? state.artistAffinity[candArtist] || 0 : 0;
  const genreBias = state.genreAffinity[candFamily] || 0;
  score += clamp(artistBias * 4, -24, 32);
  score += clamp(genreBias * 3, -15, 24);

  const skippedAt = state.skippedAtByTrackId[candidate.id];
  if (skippedAt && nowMs - skippedAt < 25 * 60 * 1000) {
    score -= 110;
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

function scoreTransitionPair(prevTrack: Track, candidate: Track): number {
  const prevVec = estimateAudioFeatures(prevTrack);
  const candVec = estimateAudioFeatures(candidate);
  const sim = computeAudioVectorCosine(prevVec, candVec);
  const prevBpm = prevTrack.bpm > 40 ? prevTrack.bpm : 112;
  const candBpm = candidate.bpm > 40 ? candidate.bpm : 112;
  const bpmBonus = Math.max(-18, 20 - Math.abs(prevBpm - candBpm) * 0.65);
  const prevCls = classifyTrackTier(prevTrack);
  const candCls = classifyTrackTier(candidate);
  const clsBonus =
    prevCls.classId === candCls.classId
      ? 24
      : prevCls.compatibleClasses.includes(candCls.classId)
        ? 10
        : -20;
  return (sim - 0.72) * 90 + bpmBonus + clsBonus;
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
  const usedBaseTitles = new Set<string>();
  const seedBase = normalizeBaseTitle(seedTrack.title);
  if (seedBase) usedBaseTitles.add(seedBase);
  const artistSessionCounts = new Map<string, number>();

  let prevTrack = seedTrack;

  while (remaining.length > 0 && ordered.length < limit) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      // 72% anchor similarity to user's original seed + 28% smooth transition from previous track
      const anchorScore = scoreCandidateTrack(
        cand,
        seedTrack,
        { ids: rollingIds, artists: rollingArtists },
        state,
        mood,
        Date.now(),
        usedBaseTitles
      );
      const transScore =
        prevTrack.id === seedTrack.id ? anchorScore : scoreTransitionPair(prevTrack, cand);
      const candArtist = extractPrimaryArtist(cand.artist);
      const sessionArtistCount = candArtist ? artistSessionCounts.get(candArtist) || 0 : 0;
      const artistCapPenalty = sessionArtistCount >= 2 ? 160 : 0;

      const combinedScore = anchorScore * 0.72 + transScore * 0.28 - artistCapPenalty;
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    const chosenBase = normalizeBaseTitle(chosen.title);
    if (chosenBase) usedBaseTitles.add(chosenBase);

    rollingIds.unshift(chosen.id);
    if (rollingIds.length > 18) rollingIds.pop();
    const chosenArtist = extractPrimaryArtist(chosen.artist);
    if (chosenArtist) {
      artistSessionCounts.set(chosenArtist, (artistSessionCounts.get(chosenArtist) || 0) + 1);
      rollingArtists.unshift(chosenArtist);
      if (rollingArtists.length > 6) rollingArtists.pop();
    }
    prevTrack = chosen;
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

  const seedLang = inferTrackLanguageRegion(track);
  const moodQueries =
    mood !== 'all' && (seedLang === 'en' || mood === 'indonesian') ? getMoodSeedQueries(mood) : [];
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

/**
 * Filter a candidate pool to genre-, vibe-, and language-cohesive tracks around `seedTrack`,
 * avoiding off-genre catalog fallback whenever cohesive candidates exist.
 */
export function selectCohesiveCandidatePool(
  seedTrack: Track,
  candidates: Track[],
  minSameLangClass = 4
): Track[] {
  const seedTier = classifyTrackTier(seedTrack);
  const seedLang = inferTrackLanguageRegion(seedTrack);
  const deduped: Track[] = [];
  const seen = new Set<string>();

  for (const cand of candidates) {
    if (!cand || !cand.id || cand.id === seedTrack.id) continue;
    if (seen.has(cand.id)) continue;
    seen.add(cand.id);
    deduped.push(cand);
  }

  const exactClassAndLang = deduped.filter((cand) => {
    const ct = classifyTrackTier(cand);
    const cl = inferTrackLanguageRegion(cand);
    if (ct.classId !== seedTier.classId) return false;
    if (seedLang !== 'en' && seedLang !== 'instrumental') {
      return cl === seedLang;
    }
    return true;
  });

  if (exactClassAndLang.length >= minSameLangClass) {
    return exactClassAndLang;
  }

  const sameLangAndClass = deduped.filter((cand) => {
    const ct = classifyTrackTier(cand);
    const cl = inferTrackLanguageRegion(cand);
    const classOk = ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
    if (!classOk) return false;
    if (seedLang !== 'en' && seedLang !== 'instrumental') {
      return cl === seedLang;
    }
    if (seedLang === 'en') {
      return cl === 'en' || ct.classId === seedTier.classId;
    }
    return true;
  });

  if (sameLangAndClass.length >= minSameLangClass) {
    return sameLangAndClass;
  }

  // Strict language lock for non-English seeds (e.g. Lagu Timur / Indonesian / K-Pop / J-Pop):
  // NEVER leak English TRACK_CATALOG fallback songs when ANY same-language candidates exist
  if (seedLang !== 'en' && seedLang !== 'instrumental') {
    const anySameLang = deduped.filter((cand) => inferTrackLanguageRegion(cand) === seedLang);
    if (anySameLang.length > 0) {
      return sameLangAndClass.length > 0
        ? [...sameLangAndClass, ...anySameLang.filter((c) => !sameLangAndClass.some((s) => s.id === c.id))]
        : anySameLang;
    }
    return [];
  }

  const compatibleClassPool = deduped.filter((cand) => {
    const ct = classifyTrackTier(cand);
    const cl = inferTrackLanguageRegion(cand);
    const classOk = ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
    if (!classOk) return false;
    if (seedLang === 'en') {
      return cl === 'en' || ct.classId === seedTier.classId;
    }
    return true;
  });

  if (compatibleClassPool.length >= 2) {
    return compatibleClassPool;
  }

  const looseClassPool = deduped.filter((cand) => {
    const ct = classifyTrackTier(cand);
    return ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
  });

  return looseClassPool.length > 0 ? looseClassPool : deduped;
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

