import { ARTISTS_DIRECTORY, type IndexedArtist } from '../data/artists800';
import type {
  EqPreset,
  LyricLine,
  MoodPreset,
  MusicFlagDimension,
  RepeatMode,
  Track,
  TrackMusicFlags,
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
  | 'indian'
  | 'arabic'
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
  | 'indian_south_asian'
  | 'arabic_middle_east'
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
  indian_south_asian: {
    classId: 'indian_south_asian',
    classLabel: 'Indian & Bollywood Hits',
    isInstrumental: false,
    compatibleClasses: [],
    peerArtists: ['Arijit Singh', 'Shreya Ghoshal', 'A.R. Rahman', 'Atif Aslam', 'Pritam', 'Diljit Dosanjh', 'AP Dhillon', 'Anirudh Ravichander'],
    keywords: [
      'arijit singh', 'shreya ghoshal', 'a.r. rahman', 'ar rahman', 'atif aslam', 'pritam',
      'vishal-shekhar', 'vishal mishra', 'badshah', 'diljit dosanjh', 'ap dhillon', 'shubh',
      'sidhu moose wala', 'siddhu moose wala', 'sanjay leela bhansali', 'sonu nigam',
      'alka yagnik', 'udit narayan', 'lata mangeshkar', 'kishore kumar', 'asha bhosle',
      'mohammed rafi', 'mahendra kapoor', 'mahendra sharma', 'shankar mahadevan',
      'armaan malik', 'jubin nautiyal', 'darshan raval', 'neha kakkar', 'tony kakkar',
      'sunidhi chauhan', 'kumar sanu', 'kavita krishnamurthy', 'mohit chauhan', 'shaan',
      'rahat fateh ali khan', 'nusrat fateh ali khan', 'ali sethi', 'shae gill',
      'anirudh ravichander', 'ilayaraja', 'ilaiyaraaja', 'yuvan shankar raja', 'sid sriram',
      'mani sharma', 'devi sri prasad', 'thaman', 'm.m. keeravani', 'anuv jain',
      'jasleen royal', 'b praak', 'akhil sachdeva', 'tulsi kumar', 'palak muchhal',
      'sachet tandon', 'parampara tandon', 'amit trivedi', 'mithoon', 'tanishk bagchi',
      'sachin-jigar', 'salim-sulaiman', 'himesh reshammiya', 'yo yo honey singh',
      'honey singh', 'guru randhawa', 'karan aujla', 'panjabi mc', 'sukhwinder singh',
      'rekha bhardwaj', 'kailash kher', 'daler mehndi', 'mika singh', 'shilpa rao',
      'jonita gandhi', 'asees kaur', 'neeti mohan', 'monali thakur', 'benny dayal',
      'nakash aziz', 'dhanush', 'rahul sipligunj', 'osman mir', 'vaishali made',
      'siddharth-garima', 'jaswinder singh', 'shiraz uppal', 'jai uttal', 't-series',
      'zee music', 'saregama', 'tips official', 'yash raj', 'sony music india', 'aditya music'
    ]
  },
  arabic_middle_east: {
    classId: 'arabic_middle_east',
    classLabel: 'Arabic & Middle East',
    isInstrumental: false,
    compatibleClasses: [],
    peerArtists: ['Amr Diab', 'Nancy Ajram', 'Elissa', 'Fairuz', 'Maher Zain', 'Sami Yusuf'],
    keywords: [
      'amr diab', 'nancy ajram', 'elissa', 'fairuz', 'maher zain', 'sami yusuf',
      'mesut kurtis', 'harris j', 'humood alkhudher', 'oum', 'didine canon 16',
      'saad lamjarred', 'mohamed ramadan', 'sherine', 'tamer hosny', 'wael kfoury',
      'kadim al sahir', 'myriam fares', 'assala', 'hussain al jassmi', 'cheb khaled', 'soolking'
    ]
  },
  indo_timur_hits: {
    classId: 'indo_timur_hits',
    classLabel: 'Indo Timur & Eastern Pop',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_indie_folk'],
    peerArtists: [
      'Dian Sorowea', 'Dandy Barakati', 'Silet Open Up', 'Juan Reza',
      'Wizz Baker', 'Fresly Nikijuluw', 'Toton Caribo', 'Mace Purba', 'Jacson Zeran',
      'Justy Aldrin', 'Vicky Salamor', 'Mario G Klau', 'Gihon Marel', 'Ecko Show',
      'Raim Laode', 'Chesylino', 'Gery Gany', 'Shine Of Black', 'Glen Sebastian',
      'Faris Adam', 'Doddie Latuharhary', 'Mitha Talahatu', 'Putry Pasanea', 'Kapthenpurek'
    ],
    keywords: [
      'near', 'dian sorowea', 'dandy barakati', 'dante nababan', 'silet open up', 'juan reza',
      'wizz baker', 'fresly nikijuluw', 'toton caribo', 'mace purba', 'jacson zeran',
      'jacson seran', 'jecson zeran', 'justy aldrin', 'vicky salamor', 'mario g klau', 'gihon marel',
      'ecko show', 'raim laode', 'chesylino', 'gery gany', 'shine of black',
      'ona hetharua', 'mitha talahatu', 'glen sebastian', 'glenn sebastian', 'doddie latuharhary',
      'yochen amos', 'whllyano', 'nyong franco', 'dj qhelfin', 'marvey kaya',
      'aldy maldini', 'faris adam', 'diva aurel', 'tenxi', 'naykilla', 'jemsii', 'm.a.c', 'mor m.a.c', 'mac papua',
      'nino minggo', 'ichad bless', 'osen hutasoit', 'vicky sianipar', 'trio ambisi',
      'kapthenpurek', 'putry pasanea', 'putri pasanea', 'mona latumahina', 'willy sopacua',
      'chaken supusepa', 'ryo domara', 'piche kota', 'novia bachmid', 'yopie latul',
      'loela drakel', 'boniex', 'trio elexis', 'verry klau', 'floo keytimu', 'uncle east',
      'randy husain', 'djipeng', 'lhc makassar', 'd ari', 'alan3m', 'edhoo jubi',
      'philips jubi', 'irsan yd', 'boorcay', 'etgard kalengke', 'omhand v', 'ajay damima',
      'wahyu selow', 'fresh boy', 'pelita timur', 'lampu1comedy', 'new gvme', 'eno smaper',
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
      'tulus', 'raisa', 'afgan', 'afgansyah reza', 'glenn fredly', 'judika', 'mahalini',
      'tiara andini', 'lyodra', 'ziva magnolya', 'bernadya', 'nadin amizah', 'pamungkas',
      'rizky febian', 'juicy luicy', 'virgoun', 'budi doremi', 'rossa', 'bunga citra lestari',
      'isyana sarasvati', 'yura yunita', 'sal priadi', 'siti nurhaliza',
      'andmesh', 'jaz', 'cakra khan', 'fabio asher', 'anggi marito',
      'keisya levronka', 'nyoman paul', 'rony parulian', 'aziz hedra', 'brisia jodie',
      'stevan pasaribu', 'mahen', 'anji', 'marcell', 'krisdayanti', 'melly goeslaw',
      'nadhif basalamah', 'batas senja', 'the lantis', 'ghea indrawari', 'ari lasso',
      'fadhilah intan', 'awdella', 'salma salsabil', 'nabila taqiyyah', 'meiska',
      'ardhito pramono', 'rendy pandugo', 'vidi aldiano', 'kaleb j', 'arash buana',
      'gangga', 'adrian khalif', 'tri suaka', 'nabila maharani', 'raffa affar', 'arief',
      'thomas arya', 'ipank', 'fauzana', 'rayola', 'david iztambul', 'gloria jessica',
      'ade govinda', 'yovie widianto', 'andi rianto', 'ruth sahanaya', 'titi dj',
      'vina panduwinata', 'gita gutawa', 'sherina', 'marion jola', 'arsy widianto',
      'nike ardilla', 'sandhy sondoro', 'tompi', 'maudy ayunda', 'agnez mo',
      'cinta laura', 'diskoria', 'laleilmanino', 'ara johari', 'aisha retno', 'andra respati'
    ]
  },
  indo_band_rock: {
    classId: 'indo_band_rock',
    classLabel: 'Indo Band & Pop Rock',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_indie_folk', 'indo_timur_hits'],
    peerArtists: ['Sheila On 7', 'Dewa 19', 'Noah', 'Padi', 'Peterpan', 'Gigi', 'Ada Band', 'Chrisye', 'Nidji'],
    keywords: [
      'dewa 19', 'sheila on 7', 'noah', 'peterpan', 'padi', 'padi reborn', 'gigi',
      'ada band', 'chrisye', 'ungu', 'nidji', 'd\'masiv', 'letto', 'slank', 'armada',
      'seventeen', 'kahitna', 'yovie', 'vierratale', 'vierra', 'geisha', 'for revenge',
      'last child', 'samsons', 'kotak', 'kerispatih', 'naff', 'drive', 'ran', 'hivi', 'maliq',
      'wali', 'kangen band', 'st12', 'andra & the backbone', 'ratu', 'duo maia', 'repvblik',
      'setia band', 'd\'bagindas', 'hijau daun', 'vagetoz', 'dadali', 'radja', 'element',
      'kla project', 'koes plus', 'once mekel', 'cokelat', 'j-rocks', 'bondan prakoso',
      'tipe-x', 'jamrud', 'the changcuters', 'naif', 'ebiet g. ade', 'superman is dead',
      'the adams'
    ]
  },
  indo_indie_folk: {
    classId: 'indo_indie_folk',
    classLabel: 'Indo Indie & Folk',
    isInstrumental: false,
    compatibleClasses: ['indo_pop_ballad', 'indo_band_rock', 'indo_timur_hits'],
    peerArtists: ['Hindia', 'Payung Teduh', 'Fourtwnty', 'Efek Rumah Kaca', 'Reality Club', 'Banda Neira', 'Feby Putri', 'Kunto Aji'],
    keywords: [
      'hindia', 'baskara putra', 'feast', '.feast', 'efek rumah kaca', 'payung teduh',
      'fourtwnty', 'banda neira', 'reality club', 'barasuara', 'feby putri', 'kunto aji',
      'fiersa besari', 'dere', 'idgitaf', 'iwan fals', 'danilla', 'dialog dini hari',
      'stars and rabbit', 'soegi bornean', 'perunggu', 'lomba sihir', 'bilal indrajaya',
      'coldiac', 'oslo ibrahim', 'teddy adhitya', 'mocca', 'sore', 'float',
      'endah n rhesa', 'adhitia sofyan', 'jason ranti', 'iksan skuter', 'nosstress',
      'silampukau', 'ari lesmana', 'enau'
    ]
  },
  indo_koplo_dangdut: {
    classId: 'indo_koplo_dangdut',
    classLabel: 'Indo Dangdut & Koplo',
    isInstrumental: false,
    compatibleClasses: ['indo_band_rock', 'indo_timur_hits'],
    peerArtists: ['Denny Caknan', 'Happy Asmara', 'Guyon Waton', 'NDX A.K.A.', 'Didi Kempot', 'Gilga Sahid', 'Ndarboy Genk', 'Aftershine', 'Lesti Kejora'],
    keywords: [
      'denny caknan', 'happy asmara', 'ndx a.k.a.', 'ndx a.k.a', 'ndx', 'guyon waton',
      'didi kempot', 'rhoma irama', 'muslih fvnky', 'masdddho', 'ndarboy genk', 'ndarboy',
      'aftershine', 'wahyu', 'lesti kejora', 'lesti', 'gilga sahid', 'via vallen',
      'nella kharisma', 'yeni inka', 'niken salindry', 'siti badriah', 'ayu ting ting',
      'dewi perssik', 'elvy sukaesih', 'farel prayoga', 'woro widowati', 'difarina indra',
      'arlida putri', 'shinta arsinta', 'esa risty', 'gildcoustic', 'omwawes', 'pendhoza',
      'dory harsa', 'abah lala', 'evan loss', 'hendra kumbara'
    ]
  },
  rnb_late_soul: {
    classId: 'rnb_late_soul',
    classLabel: 'R&B & Late-Night Soul',
    isInstrumental: false,
    compatibleClasses: ['modern_chart_pop', 'hiphop_rap_trap', 'jazz_blues_acoustic'],
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
    compatibleClasses: ['rnb_late_soul', 'piano_neoclassical', 'classic_global_legend'],
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

export type TrackLanguageRegion =
  | 'id'
  | 'hi'
  | 'ar'
  | 'ko'
  | 'ja'
  | 'es'
  | 'other'
  | 'en'
  | 'instrumental';

export interface AudioFeatureVector {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  tempoNorm: number;
}

const INDONESIAN_CLASS_IDS: SonicClassId[] = [
  'indo_timur_hits',
  'indo_pop_ballad',
  'indo_band_rock',
  'indo_indie_folk',
  'indo_koplo_dangdut'
];

// Single-word/short Indonesian artist names that collide with foreign/Indian/K-Pop/European artists
// and therefore require exact primary-artist match + non-foreign sanity checks.
const AMBIGUOUS_INDONESIAN_HOMONYMS = new Set([
  'noah', 'gigi', 'near', 'letto', 'wali', 'padi', 'drive', 'armada', 'ran',
  'jaz', 'anji', 'rossa', 'raisa', 'dere', 'mahen', 'seventeen', 'feast',
  'm.a.c', 'kotak', 'ungu', 'naff', 'slank', 'vierra', 'wahyu', 'arief', 'lesti',
  'sore', 'float', 'mocca', 'naif', 'ratu', 'radja', 'element', 'enau'
]);

const INDIC_SCRIPT_RE = /[\u0900-\u0D7F]/;
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F]/;
const HANGUL_SCRIPT_RE = /[\uAC00-\uD7AF]/;
const CJK_KANA_SCRIPT_RE = /[\u3040-\u30FF\u4E00-\u9FAF]/;
const CYRILLIC_SCRIPT_RE = /[\u0400-\u04FF]/;
const THAI_SCRIPT_RE = /[\u0E00-\u0E7F]/;

const INDIAN_GENRE_RE =
  /\b(bollywood|hindi|indian|indipop|punjabi|tamil|telugu|malayalam|kannada|marathi|gujarati|bhojpuri|bhangra|tollywood|kollywood|filmi|desi|qawwali|hindustani|carnatic|devotional|bhajan|ghazal|sufi)\b/i;

const INDIAN_TITLE_ALBUM_STRONG_RE =
  /\b(tum hi ho|dil diya|dilbar|ishq|pyaar|pyar|mohabbat|zindagi|tere bin|tere naam|tera ban jaunga|meri jaan|mera dil|humdard|yaar|jaan nisaar|sanam re|khuda|nagada sang dhol|deewani mastani|pinga|neele gagan|channa mereya|kesariya|raanjhanaa|saathiya|pasoori|naatu naatu|kolaveri|chaiyya chaiyya|bole chudiyan|kuch kuch hota hai|kal ho naa ho|tujhe dekha|kabhi khushi|kabhi alvida|heeriye|ve kamleya|apna bana le|chaleya|jhoome jo|satranga|pehle bhi main|tauba tauba|aayi nai|gerua|zaalima|bulleya|ae dil hai mushkil|agar tum saath ho|kun faya kun|tum se hi|pehla nasha|lag ja gale|teri mitti|chahun main ya naa|bawa boli|adhuri|hijr|padi padi leche|leche manasu|goliyon ki raasleela|ram-leela|hamraaz|aashiqui|brahmastra|kabir singh|baahubali|bhajan|aarti|chalisa|hanuman|mahadev|namah|guruji|jai ho|husn|raataan lambiyan|shayad|khairiyat|kalank|bekhayali|ghungroo|malhari|garmi|koka|lahore|patiala|jatt|yaari|ranjha|mann mera|pehli nazar|tera hone laga|kaho naa pyaar|suraj hua maddham|tujh mein rab|rab ne bana|deewana|mastani|bajirao|padmaavat|gangubai|devdas|pathaan|jawan|pushpa)\b/i;

const HINDI_COMMON_WORD_RE =
  /\b(tum|hum|aap|dil|tera|teri|tere|mera|meri|mere|main|mein|hai|hain|nahi|nahin|kya|kyun|yaar|jaan|pyar|pyaar|ishq|khuda|rab|sanam|saath|dene|vada|karo|gagan|tale|sang|dhol|naa|ho|ka|ki|ke|se|ko|par|bhi|ab|jab|kab|yeh|woh|tu|tujhe|tujh|mujhe|mujh|khushi|gham|duniya|sapna|raat|din|baat|chaahat|bewafa|aankhon|khwab|dhadkan|manasu|kanna|thangam|vaathi|ennavale|munbe|nenjukkul)\b/gi;

const ARABIC_GENRE_TITLE_RE =
  /\b(arabic|nasheed|maghreb|habibi|qalbi|albi|ya nabi|salam alayka|baraka allahu|rahmatun|alhamdulillah|subhanallah|assalamu|ramadan|madinah|fil madinah|dima maghreb)\b/i;

const FOREIGN_NON_ID_TITLE_RE =
  /(?:[æøåßçñ¿¡üöäßéèêëàâîïôùûãõ]|\b(tu répondais|repondais|tænd|taend|vois sur|ca ira|ça ira|geloscht|gelöscht|vorbei|meio pa|meio pá|le horla|ei levante|mergulho|malas decisiones|nada de ti|me adora|quiero|corazon|corazón|je t'aime|pourquoi|toujours|jamais|nicht|ich bin|você|voce|saudade|nao|não|coração|luftballon|bilder)\b)/i;

const TIMUR_TITLE_CUES =
  /\b(karna su sayang|tabola bale|mode pesawat|bale pulang|sa stop|sa sayang|sa tra|sa lelah|sa cinta|sa suka|sa kecewa|sa sunyi|sa menyerah|sa harus|sa janji|sa mau|sa rindu|sa pu|sa su|sa bilang|sa tunggu|sa jaga|sa pergi|sa pigi|sa pulang|sa sendiri|sa sandiri|sa bosan|ko tra|ko su|ko pu|ko tenang|ko biasa|ko bukan|ko siapa|ko bilang|ko pigi|ko lupa|ko tau|trada|jang ganggu|jang main|jang balikan|kaka main salah|aduh mamae|nona ambon|nona papua|nona kupang|nona manado|nona timur|nyong timur|ste cu|stecu|pica pica|garam dan madu|garam & madu|par ale|rumah par ale|deng dia|so bilang|su tunggu|su tra|su kalah|su bosan|beta rindu|beta sayang|beta salah|beta mau|beta janji|ale pung|orang pung|tamang pung|beta pung|pung sayang|pung kisah|pigi jo|sejak se pigi|se pigi|bintang trada|mama su tunggu|hits timur|lagu timur|rindu timur|orang timur|jaga orang pu jodoh|pu jodoh|pu hati|cuma saya|orang baru lebe gacor|lebe gacor|ubur ubur ikan lele|ngapain repot|ora urus|baju hitam|se dimana|se yang paksa|cinta beda agama|cinta sakota|cinta seng pakai spasi|orang ketiga|orang katiga|tuhan beta mau dia|paleng bae|rindu rumah|janji putih|ambon manise|gandong|taguling|gogoriso|so tanta|ta lipa|body pata|salting gila|masih sandiri|luka kanapa|bilang sa|mungkin ale|kalah harta|ujung taong|baku sayang|baku jaga|hitung hitung|babak terakhir|lesung pipi|komang|iqro)\b/i;

const TIMUR_PARTY_VIRAL_TITLE_RE =
  /\b(tabola bale|mode pesawat|pica pica|stecu|ste cu|ngapain repot|orang baru lebe gacor|lebe gacor|gacor|orang timur|ora urus|taguling|ubur ubur ikan lele|garam & madu|garam dan madu|karna su sayang|jang ganggu|ambon manise|kaka main salah|cuma saya|sa stop mabok|nona ambon|nona timur|nyong timur|bale pulang|aduh mamae|jaga orang pu jodoh|salting gila|body pata|joget timur)\b/i;

const TIMUR_GALAU_AMBON_TITLE_RE =
  /\b(tamang pung kisah|rindu rumah|rumah par ale|sa lelah|sejak se pigi|se yang paksa|cinta beda agama|cinta seng pakai spasi|orang ketiga|orang katiga|tuhan beta mau dia|janji putih|cinta sakota|beta salah apa|beta janji|paleng bae|semata karenamu|rusuk|gagal berjuang|sa menyerah|lesung pipi|komang|rindu mama|sa rindu|seng bisa jauh|bukan takdirku|sa sunyi|sa harus sendiri|sayang)\b/i;

const VIRAL_TIMUR_SIGNATURE_TITLE_RE =
  /\b(tabola bale|mode pesawat|pica pica|stecu|ste cu|ngapain repot|orang baru lebe gacor|orang timur|ora urus|taguling|ubur ubur ikan lele|garam & madu|garam dan madu|karna su sayang|bale pulang|jang ganggu|ambon manise|kaka main salah|cuma saya|jaga orang pu jodoh|nona ambon|sa stop mabok|tamang pung kisah|rindu rumah|rumah par ale|sa lelah|sejak se pigi|se yang paksa|cinta beda agama|cinta seng pakai spasi|orang ketiga|orang katiga|tuhan beta mau dia|janji putih|cinta sakota|beta salah apa|paleng bae|semata karenamu|rusuk|gagal berjuang|sa menyerah|lesung pipi)\b/i;

const NON_ORIGINAL_REMIX_COVER_RE =
  /\b(mix\s+mf|remake|remix|bootleg|mashup|jedag\s*jedug|slowed|sped\s*up|dj\s+\w+|koplo\s+version|versi\s+(?:koplo|dangdut|dj|remix|acoustic|akustik)|cover|karaoke|instrumental\s+version)\b/i;

const KOPLO_CROSSOVER_ARTIST_RE =
  /\b(arlida putri|difarina indra|happy asmara|denny caknan|yeni inka|niken salindry|shinta arsinta|esa risty|via vallen|nella kharisma|vita alvia)\b/i;

const TIMUR_DIALECT_PAIR_RE =
  /\b(?:sa|ko|beta|ale|katong|kitorang|ngana|torang|dorang)\s+(?:su|tra|pu|pung|lelah|cinta|suka|sayang|rindu|kecewa|sunyi|menyerah|harus|janji|mau|bilang|tunggu|jaga|pergi|pigi|pulang|bale|sendiri|sandiri|tetap|percaya|masih|takut|rasa|coba|lupa|minta|stop|bosan|bukan|siapa|biasa|tenang|tau|tahu|kasih|salah|kalah|paksa|hati|hilang|setia|sakit|sedih|bahagia|manis|gila|main|dapat|punya)\b/i;

const PURE_ENGLISH_TITLE_WORD_RE =
  /\b(i|we|he|she|they|it|was|were|is|are|am|been|be|have|has|had|do|does|did|will|would|could|should|can|cant|dont|wont|the|with|your|you|my|me|from|into|love|night|dream|stay|back|turn|life|slow|dancing|dark|lights?|stuck|nobody|gets|lost|lose|losing|found|skyline|window|crack|rock|twenties|snooze|years?|tryna|never|always|forever|every|where|when|what|who|why|how|heart|baby|girl|boy|time|fire|rain|home|alone|away|still|just|only|even|down|out|off|tonight|without|holding|falling|running|waiting|thinking|feeling|missing|broken|better|beautiful|crazy|wild|sweet|sorry|goodbye|hello|world|stars?|moon|sun|sky|ocean|water|blood|tears?|smile|eyes|hands|mind|soul|body|kiss|touch|hold|walk|run|fly|die|live|cry|laugh|wait|want|need|know|feel|make|take|give|come|go|see|say|tell|leave|left|keep|let|stop|play|sing|dance|sleep|wake|remember|forget|believe|call|hurt|burn|save|fake|real|nothing|something|everything|someone|everyone)\b/gi;

function hasPureEnglishTitleWithoutIndoSignal(title: string): boolean {
  const lower = String(title || '').toLowerCase();
  if (!lower) return false;
  if (
    TIMUR_TITLE_CUES.test(lower) ||
    TIMUR_DIALECT_PAIR_RE.test(lower) ||
    INDONESIAN_STRONG_TITLE_CUES.test(lower) ||
    countUniqueRegexMatches(lower, INDONESIAN_STRUCTURAL_WORD_RE) >= 1
  ) {
    return false;
  }
  const engHits = countUniqueRegexMatches(lower, PURE_ENGLISH_TITLE_WORD_RE);
  if (engHits >= 2) return true;
  const words = lower.replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter((w) => w.length >= 2);
  return words.length >= 1 && words.length <= 2 && engHits === words.length;
}

const INDONESIAN_STRONG_TITLE_CUES =
  /\b(sayang|sayangku|sayangmu|cinta|cintaku|cintamu|rindu|rinduku|rindumu|hati|hatiku|hatimu|kenangan|kisah|tertawan|trakan|mendua|dirimu|diriku|sialnya|sempurna|kasih|separuh|monokrom|tujuh belas|berdua|bertahan|menunggu|selamanya|karena|jangan|terlalu|karna|jang|komang|tak segampang|sisa rasa|hilang tanpa bilang|tak ingin usai|pesan terakhir|penjaga hati|semata karenamu|berhenti berharap|seluruh nafas|cukup tahu|dan\.\.\.|kangen|negoro|angin|mendung|rungkad|ojo|lali|pulang|pesawat|bale|tabola|trada|nona|mamae|selow|laskar|pelangi|menangis|sial|satu bulan|mati-matian|berjalan|terlintas|bintang|senja|pelukan|bunga maaf|lampu merah|lampu kuning|teruntuk|ambang rindu|jiwa yang bersedih|asmalibrasi|teman tapi mesra|hampa|dawai|kejora|begadang|syantik|bertaut|sorai|cincin|mangu|runtuh|duka|akad|tampar|teramini|seumur hidup|kulepas|ikhlas|benci kusangka|emas hantaran|haruskah aku mati|perasaanku|berpisah|berbeza|mengerti|tungkek|mambaok|rabah|palaminan|padiah|bana|ciinan|takicuah|cundamani|kalih welasku|kartonyono|medot janji|pamer bojo|banyu langit|sewu kutho|stasiun balapan|klebus|wirang|sanes|nemen|pingal|dumes|satru|cidro|ambyar|tresno|bojo|layang kangen|lungiting asmoro|terluka|tersakiti|bersedih|kecewa|melupakan|meninggalkan|bertemu|terbelah|lesung pipi|teh hijau|jatuh suka|adu rayu|percuma|bawa dia kembali|anugerah terindah|bisa tanpamu|kumau dia|hanya rindu|jikalau kau cinta|bukan dia tapi aku|mama papa larang|rahasia hati|hapus aku|sumpah dan cinta|bila aku jatuh cinta|mau dibawa kemana|asal kau bahagia|pergi pagi pulang pagi|apa kabar sayang|dilema cinta|cinta dalam hati|demi waktu|pelan pelan saja|masih cinta|tanah airku|ruang rindu|sebelum cahaya|sandaran hati|permintaan hati|terlalu manis|ku tak bisa|andai aku bisa|untukku|kala cinta menggoda|seperti yang kau minta|lilin lilin kecil|haruskah ku mati|manusia bodoh|surga cinta|setengah hati|putri iklan|cari pacar lagi|cinta tak harus memiliki|betapa ku cinta|bukan cinta biasa|purnama merindu|mistikus cinta|risalah hati|aku milikmu|pupus|sephia|seberapa pantas|hari bersamanya|pemuja rahasia|walau habis terang|ada apa denganmu|mimpi yang sempurna|menghapus jejakmu|separuh aku|hidup untukmu|yang terdalam|tak lagi sama|semua tak sama|begitu indah|kasih tak sampai|mahadewi|kepastian yang ku tunggu|11 januari|nakal|bidadari tak bersayap|kekasih terhebat|teman bahagia|bersamamu|dari mata|pandangan pertama|dekat di hati|melepasmu|bersama bintang|kau masih kekasihku|terendap laraku|akhirnya ku menemukanmu|pura pura lupa|seamin tak seiman|luka yang kurindu|jodoh pasti bertemu|panah asmara|apalah arti menunggu|mantan terindah|tak berharap lagi|tak sanggup lagi|jangan hilangkan dia|aku baik saja|rumah ke rumah|evakuasi|evaluasi|secukupnya|berdansalah|usahakan lagi|seperti ini|belum sekarang|menantu sinting|kota ini tak sama|tanpamu|bergema|tiba-tiba jumat|cari jodoh|baik baik sayang|nenekku pahlawanku|bang toyib|ada gajah dibalik batu|emang dasar|tetap bertahan|kepingan hati|salam terakhir|putih putih melati|cinta bukan harta|kekasih bayangan|harus terpisah|seluruh cinta|bukan jodohnya|menjaga jodoh|sesi potret|dunia yang nanti|bersenja gurau|sebelah mata|puisi alam|kursi goyang|mari bercerita|buat aku tersenyum|sang penghibur|tunggu aku di jakarta|sesuatu yang indah|aku cinta dia|janji setia|cinta satukan kita|bertahan pergi|cari aku di bandung|hilang tapi ada|awal kisah)\b/i;

const INDONESIAN_STRUCTURAL_WORD_RE =
  /\b(aku|kamu|kau|kita|yang|tidak|tak|dengan|untuk|dari|pada|dalam|saat|jika|kalau|bila|lagi|sudah|belum|akan|harus|bisa|masih|pernah|selalu|hanya|cuma|tentang|tanpa|kembali|pergi|datang|hidup|mati|dunia|malam|pagi|hari|waktu|bulan|tahun|mata|jiwa|luka|rasa|kata|nama|wajah|suara|senyum|mimpi|janji|setia|teman|sahabat|kekasih|wanita|perempuan|lelaki|tuhan|surga|langit|bumi|hujan|laut|kota|rumah|jalan|lampu|bunga|matahari|cahaya|gelap|terang|sepi|sunyi|indah|cantik|manis|pahit|pedih|perih|sakit|hilang|hadir|tinggal|lepas|peluk|tangis|tawa|salah|jujur|bohong|percaya|ragu|takut|kuat|lelah|tenang|damai|benci|marah|cemburu|egois|sabar|rela|tega|bodoh|gila|mesra|seperti|begini|begitu|kenapa|mengapa|bagaimana|dimana|kemana|siapa|apa|semua|seluruh|setiap|seorang|sebuah|satu|dua|tiga|tujuh|seribu|sekali|terakhir|pertama|terbaik|terindah|terdalam|kini|nanti|dulu|baru|lama|esok|kemarin|sampai|hingga|walau|meski|namun|tapi|atau|dan|demi|biar|biarlah|semoga|tolong|mohon|usahakan|tinggalkan|lupakan|maafkan|lepaskan|mengerti|pahami|ingat|lupa|tahu|tau|mau|ingin|butuh|suka|harap|punya|milik|orang|lain|bukan|jadi|buat|sama|ini|itu|sini|sana|di|ke|ku|mu|nya|ora|iso|kowe|wes|wis|nganti|wengi|tanpo|udan|dalan|liyane|nan|indak|ndak|denai|uda|adiak|rancak|lamak|sa|ko|beta|ale|su|tra|trada|pung|pigi|bale|sampe|sandiri|kanapa|tamang|gandong|lebe|jang|deng|katong|ngana|torang|taong)\b/gi;

const WORD_BOUNDARY_CACHE = new Map<string, RegExp>();

const RECOGNIZED_ARTIST_SET: Set<string> = (() => {
  const set = new Set<string>();
  for (const entry of ARTISTS_DIRECTORY) {
    const clean = entry.name.toLowerCase().trim();
    if (clean) set.add(clean);
  }
  for (const profile of Object.values(SONIC_CLASS_PROFILES)) {
    for (const p of profile.peerArtists) set.add(p.toLowerCase().trim());
    for (const kw of profile.keywords) {
      if (!AMBIGUOUS_INDONESIAN_HOMONYMS.has(kw.toLowerCase().trim())) {
        set.add(kw.toLowerCase().trim());
      }
    }
  }
  return set;
})();

export function isRecognizedCatalogArtist(
  track: Pick<Track, 'artist'>
): boolean {
  const primary = extractPrimaryArtist(track.artist);
  if (!primary) return false;
  if (RECOGNIZED_ARTIST_SET.has(primary)) return true;
  if (AMBIGUOUS_INDONESIAN_HOMONYMS.has(primary)) return true;
  for (const known of RECOGNIZED_ARTIST_SET) {
    if (known.length >= 4 && isWordBoundaryMatch(primary, known)) {
      return true;
    }
  }
  return false;
}

function isWordBoundaryMatch(haystack: string, keyword: string): boolean {
  if (!keyword || !haystack) return false;
  const key = keyword.toLowerCase().trim();
  if (!key) return false;
  let re = WORD_BOUNDARY_CACHE.get(key);
  if (!re) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    WORD_BOUNDARY_CACHE.set(key, re);
  }
  return re.test(haystack);
}

function getTrackLyricSample(track: Partial<Pick<Track, 'lyrics'>>): string {
  if (!Array.isArray(track.lyrics) || track.lyrics.length === 0) return '';
  return track.lyrics
    .slice(0, 14)
    .map((line) => line?.text || '')
    .join(' ')
    .toLowerCase();
}

function countUniqueRegexMatches(text: string, re: RegExp): number {
  if (!text) return 0;
  re.lastIndex = 0;
  const matches = text.match(re);
  if (!matches) return 0;
  return new Set(matches.map((m) => m.toLowerCase())).size;
}

function isIndianTrackSignal(
  titleRaw: string,
  artistLower: string,
  genreLower: string,
  albumLower: string,
  lyricSample: string
): boolean {
  if (
    INDIC_SCRIPT_RE.test(titleRaw) ||
    INDIC_SCRIPT_RE.test(artistLower) ||
    INDIC_SCRIPT_RE.test(albumLower) ||
    INDIC_SCRIPT_RE.test(lyricSample)
  ) {
    return true;
  }
  if (INDIAN_GENRE_RE.test(genreLower)) return true;
  if (
    SONIC_CLASS_PROFILES.indian_south_asian.keywords.some((kw) =>
      isWordBoundaryMatch(artistLower, kw)
    )
  ) {
    return true;
  }
  const titleAlbum = `${titleRaw.toLowerCase()} ${albumLower}`;
  if (INDIAN_TITLE_ALBUM_STRONG_RE.test(titleAlbum)) return true;
  if (countUniqueRegexMatches(titleAlbum, HINDI_COMMON_WORD_RE) >= 2) return true;
  if (lyricSample && countUniqueRegexMatches(lyricSample, HINDI_COMMON_WORD_RE) >= 4) {
    return true;
  }
  return false;
}

function isArabicTrackSignal(
  titleRaw: string,
  artistLower: string,
  genreLower: string,
  albumLower: string,
  lyricSample: string
): boolean {
  if (
    ARABIC_SCRIPT_RE.test(titleRaw) ||
    ARABIC_SCRIPT_RE.test(artistLower) ||
    ARABIC_SCRIPT_RE.test(albumLower)
  ) {
    return true;
  }
  const combined = `${genreLower} ${titleRaw.toLowerCase()} ${albumLower}`;
  if (ARABIC_GENRE_TITLE_RE.test(combined)) return true;
  if (
    SONIC_CLASS_PROFILES.arabic_middle_east.keywords.some((kw) =>
      isWordBoundaryMatch(artistLower, kw)
    )
  ) {
    return true;
  }
  if (lyricSample && ARABIC_SCRIPT_RE.test(lyricSample)) return true;
  return false;
}

function hasIndonesianLexicalSignal(textLower: string): boolean {
  if (!textLower) return false;
  if (
    TIMUR_TITLE_CUES.test(textLower) ||
    TIMUR_DIALECT_PAIR_RE.test(textLower) ||
    INDONESIAN_STRONG_TITLE_CUES.test(textLower)
  ) {
    return true;
  }
  return countUniqueRegexMatches(textLower, INDONESIAN_STRUCTURAL_WORD_RE) >= 2;
}

function matchesIndonesianArtistProfile(
  artistLower: string,
  primaryArtist: string,
  titleLower: string,
  genreLower: string,
  albumLower: string,
  lyricSample: string
): SonicClassProfile | null {
  const isExplicitIndoGenre =
    genreLower.includes('indonesia') ||
    /\bindo\s*(pop|rock|indie|folk|timur|hip|rap|band)\b/i.test(genreLower) ||
    genreLower.includes('dangdut') ||
    genreLower.includes('koplo') ||
    genreLower.includes('timur') ||
    genreLower.includes('malay');

  const isForeignNonIndoTitle = FOREIGN_NON_ID_TITLE_RE.test(`${titleLower} ${albumLower}`);
  const hasIndoText =
    isExplicitIndoGenre ||
    hasIndonesianLexicalSignal(`${titleLower} ${albumLower}`) ||
    (Boolean(lyricSample) && hasIndonesianLexicalSignal(lyricSample));

  for (const cid of INDONESIAN_CLASS_IDS) {
    const profile = SONIC_CLASS_PROFILES[cid];
    for (const kw of profile.keywords) {
      if (AMBIGUOUS_INDONESIAN_HOMONYMS.has(kw)) {
        if (primaryArtist !== kw) continue;
        // Reject foreign homonyms (Danish NOAH, French Near, Brazilian Letto, K-Pop SEVENTEEN)
        if (isForeignNonIndoTitle && !isExplicitIndoGenre) continue;
        if (kw === 'seventeen' && !hasIndoText) continue;
        if ((kw === 'near' || kw === 'letto' || kw === 'noah' || kw === 'drive' || kw === 'armada' || kw === 'ran' || kw === 'jaz' || kw === 'anji' || kw === 'wali' || kw === 'padi' || kw === 'rossa' || kw === 'raisa' || kw === 'dere' || kw === 'mahen' || kw === 'gigi' || kw === 'm.a.c' || kw === 'arief' || kw === 'lesti') && !hasIndoText && !isExplicitIndoGenre) {
          // For pure homonym artist names, reject obvious English/European multi-word titles when genre is generic
          if (/\b(the|with|your|from|into|love|night|dream|place|song|season|superhero|crystal|medicine|dancing|dark|lights?|ocean|back|down|over|under|never|always|forever|every|where|when|what|who|why|how)\b/i.test(titleLower)) {
            continue;
          }
        }
        return profile;
      }
      if (isWordBoundaryMatch(artistLower, kw)) {
        return profile;
      }
    }
  }
  return null;
}

export function normalizeBaseTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(
      /\b(live|remix|remake|mix\s+mf|mix|bootleg|mashup|remaster(?:ed)?|acoustic|akustik|slowed|reverb|sped up|cover|version|versi\s+\w+|edit|radio|official|audio|karaoke|dj)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferTrackLanguageRegion(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'> & Partial<Pick<Track, 'album' | 'lyrics'>>
): TrackLanguageRegion {
  const titleRaw = String(track.title || '');
  const titleLower = titleRaw.toLowerCase();
  const artistLower = String(track.artist || '').toLowerCase();
  const primaryArtist = extractPrimaryArtist(track.artist);
  const genreLower = String(track.genre || '').toLowerCase();
  const albumLower = String(track.album || '').toLowerCase();
  const lyricSample = getTrackLyricSample(track);

  // 1. Indian / South Asian (checked FIRST so Bollywood/Hindi/Tamil/Telugu/Punjabi NEVER leak into Indonesian or English)
  if (isIndianTrackSignal(titleRaw, artistLower, genreLower, albumLower, lyricSample)) {
    return 'hi';
  }

  // 2. Arabic / Middle Eastern
  if (isArabicTrackSignal(titleRaw, artistLower, genreLower, albumLower, lyricSample)) {
    return 'ar';
  }

  // 3. K-Pop & J-Pop (checked BEFORE Indonesian so K-Pop SEVENTEEN never collides with Indonesian band Seventeen)
  if (
    genreLower.includes('k-pop') ||
    genreLower.includes('kpop') ||
    genreLower.includes('korean') ||
    HANGUL_SCRIPT_RE.test(titleRaw) ||
    HANGUL_SCRIPT_RE.test(lyricSample) ||
    SONIC_CLASS_PROFILES.kpop_idol.keywords.some((kw) =>
      kw === 'seventeen'
        ? primaryArtist === 'seventeen' && !hasIndonesianLexicalSignal(titleLower)
        : isWordBoundaryMatch(artistLower, kw)
    )
  ) {
    return 'ko';
  }
  if (
    genreLower.includes('j-pop') ||
    genreLower.includes('jpop') ||
    genreLower.includes('anime') ||
    genreLower.includes('city pop') ||
    CJK_KANA_SCRIPT_RE.test(titleRaw) ||
    CJK_KANA_SCRIPT_RE.test(lyricSample) ||
    SONIC_CLASS_PROFILES.jpop_city_anime.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
  ) {
    return 'ja';
  }

  // 4. Classical / Orchestral Instrumental (checked after Indian/Arabic so Bollywood OSTs like Jai Ho stay 'hi')
  if (
    genreLower.includes('classical') ||
    genreLower.includes('neoclassical') ||
    genreLower.includes('orchestra') ||
    (genreLower.includes('soundtrack') &&
      !hasIndonesianLexicalSignal(`${titleLower} ${albumLower}`) &&
      SONIC_CLASS_PROFILES.soundtrack_epic.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))) ||
    /\b(nocturne|sonata|concerto|prelude|etude|piano solo|symphony|opus|instrumental)\b/i.test(titleLower)
  ) {
    return 'instrumental';
  }

  // 5. Explicit Cyrillic / Thai / non-Indonesian European language scripts & cues
  if (
    CYRILLIC_SCRIPT_RE.test(titleRaw) ||
    CYRILLIC_SCRIPT_RE.test(artistLower) ||
    THAI_SCRIPT_RE.test(titleRaw) ||
    THAI_SCRIPT_RE.test(artistLower)
  ) {
    return 'other';
  }
  if (
    genreLower.includes('latin') ||
    genreLower.includes('reggaeton') ||
    SONIC_CLASS_PROFILES.latin_global.keywords.some((kw) => isWordBoundaryMatch(artistLower, kw))
  ) {
    return 'es';
  }
  if (
    FOREIGN_NON_ID_TITLE_RE.test(`${titleLower} ${albumLower}`) &&
    !genreLower.includes('indonesia') &&
    !genreLower.includes('dangdut') &&
    !genreLower.includes('koplo')
  ) {
    return 'other';
  }

  // 6. Indonesian / Nusantara / Melayu (Pop, Band, Indie, Dangdut/Koplo, Lagu Timur)
  const isExplicitIndoGenre =
    genreLower.includes('indonesia') ||
    /\bindo\s*(pop|rock|indie|folk|timur|hip|rap|band)\b/i.test(genreLower) ||
    genreLower.includes('dangdut') ||
    genreLower.includes('koplo') ||
    genreLower.includes('timur') ||
    genreLower.includes('malay');

  if (
    isExplicitIndoGenre ||
    hasIndonesianLexicalSignal(`${titleLower} ${albumLower}`) ||
    (Boolean(lyricSample) && hasIndonesianLexicalSignal(lyricSample)) ||
    Boolean(
      matchesIndonesianArtistProfile(
        artistLower,
        primaryArtist,
        titleLower,
        genreLower,
        albumLower,
        lyricSample
      )
    )
  ) {
    return 'id';
  }

  return 'en';
}

export function classifyTrackTier(
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'> & Partial<Pick<Track, 'album' | 'lyrics'>>
): SonicClassProfile {
  const titleRaw = String(track.title || '');
  const artistLower = String(track.artist || '').toLowerCase();
  const primaryArtist = extractPrimaryArtist(track.artist);
  const titleLower = titleRaw.toLowerCase();
  const genreLower = String(track.genre || '').toLowerCase();
  const albumLower = String(track.album || '').toLowerCase();
  const lyricSample = getTrackLyricSample(track);

  // 1. Indian / South Asian & Arabic isolated FIRST
  if (isIndianTrackSignal(titleRaw, artistLower, genreLower, albumLower, lyricSample)) {
    return SONIC_CLASS_PROFILES.indian_south_asian;
  }
  if (isArabicTrackSignal(titleRaw, artistLower, genreLower, albumLower, lyricSample)) {
    return SONIC_CLASS_PROFILES.arabic_middle_east;
  }

  // 2. Explicit instrumental / classical cues
  if (
    /\b(nocturne|sonata|concerto|prelude|etude|piano solo|symphony|opus|op\.\s*\d|instrumental)\b/.test(
      titleLower
    )
  ) {
    return SONIC_CLASS_PROFILES.piano_neoclassical;
  }

  // 3. K-Pop & J-Pop checked BEFORE Indonesian homonyms (fixes SEVENTEEN [K-Pop])
  if (
    genreLower.includes('k-pop') ||
    genreLower.includes('kpop') ||
    genreLower.includes('korean') ||
    HANGUL_SCRIPT_RE.test(titleRaw)
  ) {
    return SONIC_CLASS_PROFILES.kpop_idol;
  }
  if (
    genreLower.includes('j-pop') ||
    genreLower.includes('jpop') ||
    genreLower.includes('anime') ||
    genreLower.includes('city pop') ||
    CJK_KANA_SCRIPT_RE.test(titleRaw)
  ) {
    return SONIC_CLASS_PROFILES.jpop_city_anime;
  }

  // 4. Non-Indonesian artist profiles checked before homonym Indonesian names (e.g. Noah Kahan, Gigi Perez, SEVENTEEN)
  for (const profile of Object.values(SONIC_CLASS_PROFILES)) {
    if (INDONESIAN_CLASS_IDS.includes(profile.classId)) continue;
    if (profile.classId === 'indian_south_asian' || profile.classId === 'arabic_middle_east') continue;
    if (
      profile.keywords.some((kw) => {
        if (kw === 'seventeen' && hasIndonesianLexicalSignal(titleLower)) return false;
        return isWordBoundaryMatch(artistLower, kw);
      })
    ) {
      return profile;
    }
  }

  // 5. Protected Indonesian artist matching (with homonym & foreign-title guards)
  const matchedIndoProfile = matchesIndonesianArtistProfile(
    artistLower,
    primaryArtist,
    titleLower,
    genreLower,
    albumLower,
    lyricSample
  );
  if (matchedIndoProfile) {
    return matchedIndoProfile;
  }

  // 6. Eastern Indonesian (Lagu Timur) titles & genres
  if (
    TIMUR_TITLE_CUES.test(`${titleLower} ${albumLower}`) ||
    TIMUR_DIALECT_PAIR_RE.test(`${titleLower} ${albumLower}`) ||
    genreLower.includes('timur')
  ) {
    return SONIC_CLASS_PROFILES.indo_timur_hits;
  }

  // 7. Indonesian / Malay / Javanese / Minang titles or lyrics with generic 'Pop'/'Rock'/'Alternative' metadata
  if (
    hasIndonesianLexicalSignal(`${titleLower} ${albumLower}`) ||
    (Boolean(lyricSample) && hasIndonesianLexicalSignal(lyricSample))
  ) {
    if (genreLower.includes('dangdut') || genreLower.includes('koplo')) return SONIC_CLASS_PROFILES.indo_koplo_dangdut;
    if (genreLower.includes('indie') || genreLower.includes('folk')) return SONIC_CLASS_PROFILES.indo_indie_folk;
    if (genreLower.includes('rock') || genreLower.includes('band')) return SONIC_CLASS_PROFILES.indo_band_rock;
    return SONIC_CLASS_PROFILES.indo_pop_ballad;
  }

  const family = resolveGenreFamily(genreLower, artistLower, titleLower);
  if (family === 'indian') return SONIC_CLASS_PROFILES.indian_south_asian;
  if (family === 'arabic') return SONIC_CLASS_PROFILES.arabic_middle_east;
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
  pop: ['rnb', 'kpop', 'jpop', 'electronic', 'latin'],
  rock: ['acoustic', 'pop', 'electronic'],
  hiphop: ['rnb', 'electronic', 'pop', 'latin'],
  electronic: ['pop', 'hiphop', 'jpop', 'kpop'],
  rnb: ['pop', 'hiphop', 'jazz'],
  kpop: ['pop', 'electronic', 'rnb', 'jpop'],
  jpop: ['pop', 'electronic', 'kpop', 'rock'],
  indonesian: ['indonesian'],
  indian: ['indian'],
  arabic: ['arabic'],
  latin: ['pop', 'hiphop', 'rnb'],
  acoustic: ['pop', 'rock', 'jazz'],
  jazz: ['rnb', 'acoustic', 'classical'],
  classical: ['jazz', 'acoustic'],
  global: ['pop', 'latin', 'acoustic']
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
  const primary = extractPrimaryArtist(artist);

  if (isIndianTrackSignal(title, a, g, '', '')) return 'indian';
  if (isArabicTrackSignal(title, a, g, '', '')) return 'arabic';
  if (g.includes('k-pop') || g.includes('kpop') || g.includes('korean')) return 'kpop';
  if (g.includes('j-pop') || g.includes('jpop') || g.includes('anime') || g.includes('city pop')) return 'jpop';

  if (
    g.includes('indonesia') ||
    /\bindo\s*(pop|rock|indie|folk|timur|hip|rap|band)\b/i.test(g) ||
    g.includes('dangdut') ||
    g.includes('koplo') ||
    g.includes('timur') ||
    g.includes('malay') ||
    hasIndonesianLexicalSignal(t) ||
    Boolean(matchesIndonesianArtistProfile(a, primary, t, g, '', ''))
  ) {
    return 'indonesian';
  }
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
    case 'indo_timur_hits': {
      const isGalauTimur =
        TIMUR_GALAU_AMBON_TITLE_RE.test(titleLower) && !TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower);
      base = isGalauTimur
        ? { energy: 0.48, valence: 0.36, danceability: 0.56, acousticness: 0.54, instrumentalness: 0.02 }
        : { energy: 0.78, valence: 0.74, danceability: 0.86, acousticness: 0.22, instrumentalness: 0.02 };
      break;
    }
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
    case 'indian_south_asian':
      base = { energy: 0.68, valence: 0.60, danceability: 0.70, acousticness: 0.35, instrumentalness: 0.03 };
      break;
    case 'arabic_middle_east':
      base = { energy: 0.62, valence: 0.56, danceability: 0.64, acousticness: 0.42, instrumentalness: 0.04 };
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

export const MUSIC_FLAG_DIMENSIONS: readonly MusicFlagDimension[] = [
  'language_region',
  'regional_scene',
  'sonic_class',
  'primary_genre',
  'subgenre_style',
  'tempo_tier',
  'energy_level',
  'mood_valence',
  'danceability_tier',
  'acoustic_profile',
  'vocal_presence',
  'vocal_delivery',
  'instrumentation_core',
  'era_decade',
  'popularity_tier',
  'release_format',
  'lyric_theme',
  'listening_context',
  'rhythm_feel',
  'production_polish',
  'explicit_rating',
  'duration_bucket',
  'dialect_script',
  'catalog_provenance',
  'viral_momentum',
  'co_listen_cluster'
] as const;

const MULTI_FLAG_WEIGHTS: Record<MusicFlagDimension, number> = {
  language_region: 0.13,
  regional_scene: 0.11,
  sonic_class: 0.09,
  co_listen_cluster: 0.11,
  primary_genre: 0.03,
  subgenre_style: 0.08,
  tempo_tier: 0.05,
  energy_level: 0.06,
  mood_valence: 0.06,
  danceability_tier: 0.03,
  acoustic_profile: 0.04,
  vocal_presence: 0.03,
  vocal_delivery: 0.03,
  instrumentation_core: 0.04,
  era_decade: 0.025,
  // Popularity, viral momentum, and catalog provenance are scored directionally (hits > deep cuts), not by equality
  popularity_tier: 0,
  viral_momentum: 0,
  catalog_provenance: 0,
  release_format: 0.02,
  lyric_theme: 0.025,
  listening_context: 0.035,
  rhythm_feel: 0.045,
  production_polish: 0.015,
  explicit_rating: 0.005,
  duration_bucket: 0.01,
  dialect_script: 0.03
};

const MINANG_MELAYU_CUES =
  /\b(minang|padang|tungkek|mambaok|rabah|palaminan|padiah|bana|ciinan|takicuah|melayu|malay|fauzana|ipank|rayola|thomas arya|arief|siti nurhaliza|yuna|insomniacks|search|naim daniel)\b/i;
const JAWA_KOPLO_CUES =
  /\b(jawa|koplo|dangdut|campursari|negoro|rungkad|ojo|cundamani|kalih welas|kartonyono|bojo|banyu langit|sewu kutho|klebus|wirang|sanes|nemen|pingal|dumes|satru|cidro|ambyar|tresno|denny caknan|happy asmara|guyon waton|ndx|didi kempot|gilga sahid|aftershine|ndarboy|lesti|rhoma irama)\b/i;
const HEARTBREAK_THEME_RE =
  /\b(sial|sisa rasa|luka|duka|menangis|tersakiti|terluka|patah|kecewa|berpisah|hilang|pergimu|tanpamu|meninggalkan|melupakan|pupus|hampa|runtuh|bersedih|tak ingin usai|tak segampang|pesan terakhir|bukan dia|cinta tak harus|someone like you|hello|fix you|broken|heartbreak|tears|goodbye|sorry|cry|lonely|hurt|pain|miss you|lose you)\b/i;
const ROMANCE_THEME_RE =
  /\b(sayang|cinta|rindu|kasih|pelukan|mesra|jodoh|setia|selamanya|sempurna|komang|bertaut|akad|bidadari|kekasih|penjaga hati|jatuh suka|love story|perfect|die with a smile|adore|darling|sweetheart|forever|romance|kiss|marry|beloved)\b/i;
const NOSTALGIA_THEME_RE =
  /\b(kenangan|masa lalu|dulu|tujuh belas|sepia|sephia|kemarin|monokrom|rumah ke rumah|kangen|sewaktu|klasik|yesterday|memories|7 years|nostalgia|retro|remember|childhood|old days)\b/i;
const PARTY_THEME_RE =
  /\b(party|dance|club|tonight|espresso|levitating|dynamite|apt|tabola bale|pica pica|stecu|gacor|joget|goyang|syantik|begadang|celebrate|friday|weekend|turn up|banger)\b/i;
const ANTHEM_THEME_RE =
  /\b(believer|lose yourself|bohemian|viva la vida|laskar pelangi|tanah airku|beraksi|evaluasi|secukupnya|kita usahakan|bertahan|hidup harus tetap berjalan|fighter|stronger|unstoppable|champion|rise|dream)\b/i;

export interface MultiFlagSimilarityResult {
  similarity: number;
  matchedCount: number;
  totalFlags: number;
  matchedDimensions: MusicFlagDimension[];
}

export function estimateTrackBpm(
  track: Pick<Track, 'title' | 'artist' | 'genre'> & Partial<Pick<Track, 'bpm' | 'album' | 'lyrics'>>
): number {
  const cls = classifyTrackTier({ ...track, bpm: track.bpm && track.bpm > 40 ? track.bpm : 112 }).classId;
  const titleLower = String(track.title || '').toLowerCase();
  let base = 116;
  switch (cls) {
    case 'piano_neoclassical': base = 76; break;
    case 'soundtrack_epic': base = 88; break;
    case 'indo_pop_ballad': base = 82; break;
    case 'indo_indie_folk': base = 94; break;
    case 'rnb_late_soul': base = 92; break;
    case 'jazz_blues_acoustic': base = 96; break;
    case 'hiphop_rap_trap': base = 98; break;
    case 'latin_global': base = 102; break;
    case 'arabic_middle_east': base = 104; break;
    case 'indian_south_asian': base = 106; break;
    case 'indo_timur_hits':
      base =
        TIMUR_GALAU_AMBON_TITLE_RE.test(titleLower) && !TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower)
          ? 96
          : 118;
      break;
    case 'classic_global_legend': base = 116; break;
    case 'alt_indie_rock': base = 118; break;
    case 'modern_chart_pop': base = 118; break;
    case 'indo_band_rock': base = 122; break;
    case 'kpop_idol': base = 126; break;
    case 'electronic_dance_synth': base = 128; break;
    case 'jpop_city_anime': base = 132; break;
    case 'indo_koplo_dangdut': base = 138; break;
    case 'heavy_metal_hard': base = 148; break;
  }
  if (/\b(acoustic|unplugged|ballad|slowed|lullaby)\b/.test(titleLower)) {
    base = Math.max(64, base - 14);
  } else if (/\b(remix|club|dance|party|sped up)\b/.test(titleLower)) {
    base = Math.min(168, base + 12);
  }
  return base;
}

/**
 * Computes 24 orthogonal, real-world musical flags for every track (across all federated
 * global catalogs and local studio masters) so similarity never relies on 1 single genre tag.
 */
export function computeTrackMusicFlags(
  track: Pick<Track, 'id' | 'title' | 'artist' | 'album' | 'genre' | 'bpm' | 'duration'> &
    Partial<Pick<Track, 'lyrics' | 'streamSource' | 'sourceTag' | 'releaseYear' | 'explicit' | 'popularityRank' | 'youtubeViews' | 'musicFlags'>>
): TrackMusicFlags {
  const titleRaw = String(track.title || '');
  const titleLower = titleRaw.toLowerCase();
  const artistLower = String(track.artist || '').toLowerCase();
  const albumLower = String(track.album || '').toLowerCase();
  const genreLower = String(track.genre || '').toLowerCase();
  const lyricSample = getTrackLyricSample(track);
  const fullText = `${titleLower} ${artistLower} ${albumLower} ${genreLower} ${lyricSample}`;

  const lang = inferTrackLanguageRegion(track);
  const tier = classifyTrackTier(track);
  const family = resolveGenreFamily(track.genre, track.artist, track.title);
  const bpm = track.bpm > 40 ? track.bpm : estimateTrackBpm(track);
  const vec = estimateAudioFeatures({ ...track, bpm });
  const dur = track.duration > 0 ? track.duration : 210;

  // 1. regional_scene
  let regionalScene = 'global_crossover';
  if (lang === 'id') {
    if (tier.classId === 'indo_timur_hits') regionalScene = 'indo_timur';
    else if (tier.classId === 'indo_koplo_dangdut' || JAWA_KOPLO_CUES.test(fullText)) regionalScene = 'indo_jawa_koplo';
    else if (MINANG_MELAYU_CUES.test(fullText)) regionalScene = 'indo_minang_melayu';
    else if (tier.classId === 'indo_indie_folk') regionalScene = 'indo_indie_senja';
    else if (tier.classId === 'indo_band_rock') regionalScene = 'indo_band_classic';
    else regionalScene = 'indo_jakarta_pop';
  } else if (lang === 'ko') regionalScene = 'kpop_seoul';
  else if (lang === 'ja') regionalScene = 'jpop_tokyo';
  else if (lang === 'es') regionalScene = 'latin_urbano';
  else if (lang === 'hi') regionalScene = 'bollywood_south_asia';
  else if (lang === 'ar') regionalScene = 'arabic_mena';
  else if (lang === 'instrumental') regionalScene = 'classical_europe';
  else if (lang === 'en') regionalScene = 'us_uk_mainstream';

  // 2. subgenre_style
  let subgenreStyle = 'contemporary_pop';
  switch (tier.classId) {
    case 'piano_neoclassical': subgenreStyle = 'neoclassical_piano'; break;
    case 'soundtrack_epic': subgenreStyle = 'orchestral_score'; break;
    case 'indo_timur_hits': subgenreStyle = vec.energy >= 0.68 ? 'eastern_dance_groove' : 'eastern_romantic_pop'; break;
    case 'indo_pop_ballad': subgenreStyle = vec.energy <= 0.52 ? 'soulful_ballad' : 'modern_indo_pop'; break;
    case 'indo_band_rock': subgenreStyle = 'melodic_pop_rock'; break;
    case 'indo_indie_folk': subgenreStyle = 'indie_folk_alt'; break;
    case 'indo_koplo_dangdut': subgenreStyle = 'dangdut_koplo'; break;
    case 'indian_south_asian': subgenreStyle = genreLower.includes('punjabi') ? 'punjabi_bhangra' : 'bollywood_filmi'; break;
    case 'arabic_middle_east': subgenreStyle = 'arabic_pop_nasheed'; break;
    case 'rnb_late_soul': subgenreStyle = 'alt_rnb_soul'; break;
    case 'classic_global_legend': subgenreStyle = 'classic_anthem'; break;
    case 'kpop_idol': subgenreStyle = 'kpop_dance_pop'; break;
    case 'jpop_city_anime': subgenreStyle = genreLower.includes('city') ? 'city_pop' : 'jpop_anime_rock'; break;
    case 'alt_indie_rock': subgenreStyle = 'alternative_rock'; break;
    case 'heavy_metal_hard': subgenreStyle = 'hard_rock_metal'; break;
    case 'electronic_dance_synth': subgenreStyle = 'synth_electronic_dance'; break;
    case 'hiphop_rap_trap': subgenreStyle = 'melodic_hiphop_trap'; break;
    case 'jazz_blues_acoustic': subgenreStyle = 'jazz_acoustic_vocal'; break;
    case 'latin_global': subgenreStyle = 'reggaeton_latin_pop'; break;
    default: subgenreStyle = vec.acousticness >= 0.55 ? 'acoustic_pop_ballad' : 'mainstream_chart_pop'; break;
  }

  // 3. tempo_tier
  const tempoTier =
    bpm < 85 ? 'slow_ballad' : bpm <= 102 ? 'downtempo' : bpm <= 118 ? 'midtempo' : bpm <= 134 ? 'upbeat' : 'fast_drive';

  // 4. energy_level
  const energyLevel =
    vec.energy < 0.30 ? 'very_low' : vec.energy < 0.50 ? 'low' : vec.energy < 0.70 ? 'medium' : vec.energy < 0.85 ? 'high' : 'explosive';

  // 5. mood_valence
  let moodValence = 'warm_romantic';
  if (tier.classId === 'heavy_metal_hard' || (vec.energy >= 0.78 && vec.valence <= 0.45)) moodValence = 'intense_dark';
  else if (HEARTBREAK_THEME_RE.test(`${titleLower} ${lyricSample}`) || vec.valence < 0.36) moodValence = 'melancholic';
  else if (vec.valence < 0.48) moodValence = 'bittersweet';
  else if (PARTY_THEME_RE.test(titleLower) || (vec.valence >= 0.72 && vec.danceability >= 0.76)) moodValence = 'euphoric_party';
  else if (vec.valence >= 0.62) moodValence = 'uplifting';

  // 6. danceability_tier
  const danceabilityTier =
    vec.danceability < 0.35 ? 'ambient' : vec.danceability < 0.58 ? 'sway' : vec.danceability < 0.78 ? 'groove' : 'club_floor';

  // 7. acoustic_profile
  const acousticProfile =
    vec.acousticness >= 0.75 ? 'pure_acoustic' : vec.acousticness >= 0.48 ? 'organic_band' : vec.acousticness >= 0.22 ? 'hybrid_studio' : 'electronic_synth';

  // 8. vocal_presence
  let vocalPresence = 'lead_vocal';
  if (tier.isInstrumental || vec.instrumentalness >= 0.75) vocalPresence = 'instrumental';
  else if (/\b(feat\.?|ft\.?|with|&|,| x )\b/i.test(track.artist || '') && !/\b(?:&|\+)\s+the\b/i.test(track.artist || '')) vocalPresence = 'duet_collab';
  else if (tier.classId === 'hiphop_rap_trap' || genreLower.includes('rap') || genreLower.includes('hip-hop')) vocalPresence = 'rap_cadence';
  else if (['indo_band_rock', 'alt_indie_rock', 'heavy_metal_hard', 'kpop_idol'].includes(tier.classId)) vocalPresence = 'group_band';

  // 9. vocal_delivery
  let vocalDelivery = 'melodic_pop';
  if (vocalPresence === 'instrumental') vocalDelivery = 'non_vocal';
  else if (vocalPresence === 'rap_cadence') vocalDelivery = 'rhythmic_flow';
  else if (vec.energy <= 0.48 && vec.acousticness >= 0.55) vocalDelivery = 'soft_intimate';
  else if (['classic_global_legend', 'heavy_metal_hard', 'alt_indie_rock'].includes(tier.classId)) vocalDelivery = 'choral_anthemic';
  else if (['judika', 'lyodra', 'mahalini', 'adele', 'whitney houston', 'celine dion', 'rossa', 'cakra khan', 'shreya ghoshal', 'arijit singh'].some((k) => artistLower.includes(k))) vocalDelivery = 'power_belting';

  // 10. instrumentation_core
  let instrumentationCore = 'hybrid_pop_kit';
  if (tier.classId === 'piano_neoclassical') instrumentationCore = 'piano_strings';
  else if (tier.classId === 'soundtrack_epic') instrumentationCore = 'orchestral_brass';
  else if (tier.classId === 'indo_koplo_dangdut') instrumentationCore = 'kendang_koplo';
  else if (tier.classId === 'indo_timur_hits') instrumentationCore = 'timur_reggae_beat';
  else if (tier.classId === 'indo_indie_folk' || tier.classId === 'jazz_blues_acoustic' || vec.acousticness >= 0.62) instrumentationCore = 'acoustic_guitar_piano';
  else if (['indo_band_rock', 'alt_indie_rock', 'heavy_metal_hard', 'classic_global_legend'].includes(tier.classId)) instrumentationCore = 'electric_band_drums';
  else if (['electronic_dance_synth', 'hiphop_rap_trap', 'kpop_idol', 'rnb_late_soul'].includes(tier.classId)) instrumentationCore = 'synth_808';

  // 11. era_decade
  let eraDecade = '2020s_current';
  if (typeof track.releaseYear === 'number' && track.releaseYear > 1900) {
    if (track.releaseYear < 2000) eraDecade = 'classic_pre_2000';
    else if (track.releaseYear < 2010) eraDecade = '2000s_nostalgia';
    else if (track.releaseYear < 2020) eraDecade = '2010s_modern';
    else eraDecade = '2020s_current';
  } else if (inferEraBucket(track) === 'classic') {
    eraDecade = ['dewa 19', 'sheila on 7', 'padi', 'peterpan', 'ungu', 'nidji', 'ada band', 'samsons', 'letto'].some((k) => artistLower.includes(k))
      ? '2000s_nostalgia'
      : 'classic_pre_2000';
  }

  // 12. popularity_tier (real global & regional hit prominence)
  const ytViews = Number(track.youtubeViews) || 0;
  const dzRank = Number(track.popularityRank) || 0;
  const isNonOriginal =
    NON_ORIGINAL_REMIX_COVER_RE.test(`${titleLower} ${albumLower}`) ||
    (tier.classId === 'indo_timur_hits' && KOPLO_CROSSOVER_ARTIST_RE.test(artistLower));
  const isViralTimurSignature =
    tier.classId === 'indo_timur_hits' &&
    !isNonOriginal &&
    VIRAL_TIMUR_SIGNATURE_TITLE_RE.test(titleLower);

  let popularityTier = 'regional_popular';
  if (ytViews >= 100_000_000 || dzRank >= 750_000 || track.streamSource === 'studio-master') popularityTier = 'global_mega_hit';
  else if (ytViews >= 10_000_000 || dzRank >= 300_000 || isViralTimurSignature) popularityTier = 'mainstream_hit';
  else if (ytViews >= 1_000_000 || dzRank >= 80_000 || isRecognizedCatalogArtist(track)) popularityTier = 'regional_popular';
  else if (ytViews >= 50_000 || dzRank >= 15_000) popularityTier = 'rising_indie';
  else popularityTier = 'deep_cut';

  // 13. release_format
  let releaseFormat = 'studio_single';
  if (/\b(from\s+"|ost\b|soundtrack|motion picture)\b/i.test(`${titleLower} ${albumLower}`)) releaseFormat = 'soundtrack_ost';
  else if (/\b(live|unplugged|concert|session)\b/i.test(titleLower)) releaseFormat = 'live_session';
  else if (isNonOriginal || /\b(remix|mix|edit|sped up|slowed)\b/i.test(titleLower)) releaseFormat = 'remix_edit';
  else if (/\b(acoustic|piano version)\b/i.test(titleLower)) releaseFormat = 'acoustic_version';
  else if (albumLower && albumLower !== 'single' && albumLower !== titleLower) releaseFormat = 'album_track';

  // 14. lyric_theme
  let lyricTheme = 'self_reflection';
  if (tier.isInstrumental) lyricTheme = 'instrumental_score';
  else if (HEARTBREAK_THEME_RE.test(`${titleLower} ${lyricSample}`)) lyricTheme = 'heartbreak_grief';
  else if (ROMANCE_THEME_RE.test(`${titleLower} ${lyricSample}`)) lyricTheme = 'romance_devotion';
  else if (PARTY_THEME_RE.test(`${titleLower} ${lyricSample}`)) lyricTheme = 'celebration_party';
  else if (NOSTALGIA_THEME_RE.test(`${titleLower} ${lyricSample}`)) lyricTheme = 'nostalgia_memory';
  else if (ANTHEM_THEME_RE.test(`${titleLower} ${lyricSample}`)) lyricTheme = 'anthem_empowerment';

  // 15. listening_context
  let listeningContext = 'chill_coffee';
  if (tier.isInstrumental) listeningContext = 'focus_study';
  else if (vec.energy >= 0.80 && bpm >= 122) listeningContext = 'workout_energy';
  else if (danceabilityTier === 'club_floor' || moodValence === 'euphoric_party') listeningContext = 'party_hangout';
  else if (moodValence === 'melancholic' && vec.energy <= 0.55) listeningContext = 'heartbreak_rain';
  else if (tier.classId === 'rnb_late_soul' || (vec.energy <= 0.54 && bpm <= 106)) listeningContext = 'late_night';
  else if (['indo_band_rock', 'classic_global_legend', 'alt_indie_rock', 'modern_chart_pop'].includes(tier.classId)) listeningContext = 'roadtrip_drive';

  // 16. rhythm_feel
  let rhythmFeel = 'straight_4_4';
  if (tier.isInstrumental) rhythmFeel = 'rubato_free';
  else if (tier.classId === 'indo_koplo_dangdut') rhythmFeel = 'koplo_percussion';
  else if (tier.classId === 'indo_timur_hits') {
    rhythmFeel =
      TIMUR_GALAU_AMBON_TITLE_RE.test(titleLower) && !TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower)
        ? 'timur_ballad_sway'
        : 'reggae_bounce';
  }
  else if (tier.classId === 'hiphop_rap_trap') rhythmFeel = 'half_time_trap';
  else if (['rnb_late_soul', 'latin_global', 'electronic_dance_synth', 'jazz_blues_acoustic'].includes(tier.classId)) rhythmFeel = 'syncopated_groove';

  // 17. production_polish
  let productionPolish = 'hi_fi_studio';
  if (releaseFormat === 'live_session') productionPolish = 'concert_live';
  else if (tier.classId === 'piano_neoclassical' || tier.classId === 'soundtrack_epic') productionPolish = 'orchestral_hall';
  else if (eraDecade === 'classic_pre_2000' || tier.classId === 'jazz_blues_acoustic') productionPolish = 'analog_warm';
  else if (tier.classId === 'indo_indie_folk' && vec.energy <= 0.52) productionPolish = 'lo_fi_warm_indie';

  // 18. explicit_rating
  const explicitRating = track.explicit ? 'explicit' : 'clean';

  // 19. duration_bucket
  const durationBucket =
    dur < 160 ? 'short_hook' : dur <= 245 ? 'radio_standard' : dur <= 330 ? 'extended_ballad' : 'epic_long';

  // 20. dialect_script
  let dialectScript = `latin_${lang}`;
  if (lang === 'id') {
    if (regionalScene === 'indo_timur') dialectScript = 'latin_timur';
    else if (regionalScene === 'indo_jawa_koplo') dialectScript = 'latin_jawa';
    else if (regionalScene === 'indo_minang_melayu') dialectScript = 'latin_minang';
    else dialectScript = 'latin_id';
  } else if (HANGUL_SCRIPT_RE.test(titleRaw) || lang === 'ko') dialectScript = 'hangul_ko';
  else if (CJK_KANA_SCRIPT_RE.test(titleRaw) || lang === 'ja') dialectScript = 'kana_kanji_ja';
  else if (INDIC_SCRIPT_RE.test(titleRaw) || lang === 'hi') dialectScript = 'indic_hi';
  else if (ARABIC_SCRIPT_RE.test(titleRaw) || lang === 'ar') dialectScript = 'arabic_ar';

  // 21. catalog_provenance
  let catalogProvenance = 'federated_global';
  if (track.streamSource === 'studio-master' && track.id.startsWith('track-')) catalogProvenance = 'studio_master';
  else if (track.id.startsWith('dz-') || track.id.startsWith('catalog-dz')) catalogProvenance = 'deezer_global';
  else if (track.id.startsWith('it-') || track.id.startsWith('rss-') || /^catalog-\d+$/.test(track.id)) catalogProvenance = 'apple_music';
  else if (track.id.startsWith('audius-') || track.sourceTag === 'Audius') catalogProvenance = 'audius_open';
  else if (track.id.startsWith('mb-') || track.id.startsWith('catalog-mb-')) catalogProvenance = 'musicbrainz';
  else if (track.id.startsWith('yt-') || track.id.startsWith('stream-') || track.id.startsWith('catalog-yt-')) catalogProvenance = 'youtube_music';

  // 25. viral_momentum (separates chart/editorial hits from deep cuts & remixes)
  let viralMomentum = 'catalog_standard';
  if (!isNonOriginal) {
    if (
      ytViews >= 50_000_000 ||
      dzRank >= 800_000 ||
      (isViralTimurSignature && (TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower) || dzRank >= 840_000))
    ) {
      viralMomentum = 'chart_viral_hit';
    } else if (
      ytViews >= 10_000_000 ||
      dzRank >= 450_000 ||
      isViralTimurSignature ||
      track.streamSource === 'studio-master'
    ) {
      viralMomentum = 'editorial_signature';
    } else if (ytViews >= 1_000_000 || dzRank >= 120_000) {
      viralMomentum = 'steady_popular';
    }
  }

  // 26. co_listen_cluster (Spotify-style collaborative listening neighborhood)
  let coListenCluster = 'global_pop_chart';
  switch (tier.classId) {
    case 'indo_timur_hits':
      coListenCluster =
        TIMUR_GALAU_AMBON_TITLE_RE.test(titleLower) && !TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower)
          ? 'timur_ambon_galau'
          : 'timur_party_viral';
      break;
    case 'indo_pop_ballad':
      coListenCluster = regionalScene === 'indo_minang_melayu' ? 'indo_minang_melayu' : 'indo_pop_mainstream';
      break;
    case 'indo_indie_folk': coListenCluster = 'indo_senja_indie'; break;
    case 'indo_band_rock': coListenCluster = 'indo_band_2000s'; break;
    case 'indo_koplo_dangdut': coListenCluster = 'indo_koplo_jawa'; break;
    case 'rnb_late_soul': coListenCluster = 'rnb_late_night'; break;
    case 'classic_global_legend': coListenCluster = 'classic_anthem_era'; break;
    case 'kpop_idol': coListenCluster = 'kpop_hits'; break;
    case 'jpop_city_anime': coListenCluster = 'jpop_anime'; break;
    case 'alt_indie_rock': coListenCluster = 'alt_rock_modern'; break;
    case 'heavy_metal_hard': coListenCluster = 'metal_hard_rock'; break;
    case 'electronic_dance_synth': coListenCluster = 'electronic_club'; break;
    case 'hiphop_rap_trap': coListenCluster = 'hiphop_rap_core'; break;
    case 'jazz_blues_acoustic': coListenCluster = 'acoustic_jazz_warm'; break;
    case 'piano_neoclassical':
    case 'soundtrack_epic': coListenCluster = 'classical_orchestral'; break;
    case 'latin_global': coListenCluster = 'latin_urbano_hits'; break;
    case 'indian_south_asian': coListenCluster = 'bollywood_hits'; break;
    case 'arabic_middle_east': coListenCluster = 'arabic_hits'; break;
    default: coListenCluster = 'global_pop_chart'; break;
  }

  const dimensions: Record<MusicFlagDimension, string> = {
    language_region: lang,
    regional_scene: regionalScene,
    sonic_class: tier.classId,
    primary_genre: family,
    subgenre_style: subgenreStyle,
    tempo_tier: tempoTier,
    energy_level: energyLevel,
    mood_valence: moodValence,
    danceability_tier: danceabilityTier,
    acoustic_profile: acousticProfile,
    vocal_presence: vocalPresence,
    vocal_delivery: vocalDelivery,
    instrumentation_core: instrumentationCore,
    era_decade: eraDecade,
    popularity_tier: popularityTier,
    release_format: releaseFormat,
    lyric_theme: lyricTheme,
    listening_context: listeningContext,
    rhythm_feel: rhythmFeel,
    production_polish: productionPolish,
    explicit_rating: explicitRating,
    duration_bucket: durationBucket,
    dialect_script: dialectScript,
    catalog_provenance: catalogProvenance,
    viral_momentum: viralMomentum,
    co_listen_cluster: coListenCluster
  };

  const tags = MUSIC_FLAG_DIMENSIONS.map((dim) => `${dim}:${dimensions[dim]}`);
  return {
    dimensions,
    tags,
    count: tags.length
  };
}

export function enrichTrackWithMusicFlags(track: Track): Track {
  if (track.musicFlags && track.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length) {
    return track;
  }
  return {
    ...track,
    musicFlags: computeTrackMusicFlags(track)
  };
}

export function computeMultiFlagSimilarity(
  seedFlags: TrackMusicFlags,
  candFlags: TrackMusicFlags
): MultiFlagSimilarityResult {
  let weightedOverlap = 0;
  let totalWeight = 0;
  const matchedDimensions: MusicFlagDimension[] = [];

  for (const dim of MUSIC_FLAG_DIMENSIONS) {
    const w = MULTI_FLAG_WEIGHTS[dim];
    totalWeight += w;
    if (seedFlags.dimensions[dim] === candFlags.dimensions[dim]) {
      weightedOverlap += w;
      matchedDimensions.push(dim);
    }
  }

  return {
    similarity: totalWeight > 0 ? clamp(weightedOverlap / totalWeight, 0, 1) : 0,
    matchedCount: matchedDimensions.length,
    totalFlags: MUSIC_FLAG_DIMENSIONS.length,
    matchedDimensions
  };
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

  const seedFlags =
    seedTrack.musicFlags && seedTrack.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length
      ? seedTrack.musicFlags
      : computeTrackMusicFlags(seedTrack);
  const candFlags =
    candidate.musicFlags && candidate.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length
      ? candidate.musicFlags
      : computeTrackMusicFlags(candidate);
  const flagSim = computeMultiFlagSimilarity(seedFlags, candFlags);

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
  } else if (
    mood === 'all' &&
    candArtist !== seedArtist &&
    !(
      candClass.classId === seedClass.classId &&
      seedFlags.dimensions.regional_scene === candFlags.dimensions.regional_scene &&
      flagSim.similarity >= 0.5
    )
  ) {
    score -= 110;
  }

  // 0b. Strict Language / Market Isolation (zero Indian/Arabic/foreign drift from Indonesian or English seeds)
  if (seedLang === candLang) {
    score += seedLang === 'en' ? 16 : 42;
  } else if (
    seedLang === 'id' ||
    seedLang === 'hi' ||
    seedLang === 'ar' ||
    candLang === 'hi' ||
    candLang === 'ar' ||
    candLang === 'other'
  ) {
    score -= 600;
  } else if (seedLang !== 'en' && seedLang !== 'instrumental') {
    const userBridgesLanguage = (state.genreAffinity[candFamily] || 0) >= 4;
    score -= userBridgesLanguage ? 32 : 140;
  } else if (seedLang === 'en' && candLang !== 'en' && candLang !== 'instrumental') {
    const userPrefersRegion = (state.genreAffinity[candFamily] || 0) >= 4;
    score -= userPrefersRegion ? 24 : 120;
  }

  const seedBaseTitle = normalizeBaseTitle(seedTrack.title);
  const candBaseTitle = normalizeBaseTitle(candidate.title);
  if ((seedBaseTitle && candBaseTitle && seedBaseTitle === candBaseTitle) || (candBaseTitle && usedBaseTitles?.has(candBaseTitle))) {
    score -= 720;
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

  // 2. Multi-Dimensional 26-Flag Music Genome Overlap + Co-Listen Cluster + Directional Hit Prominence
  score += clamp(Math.round((flagSim.similarity - 0.42) * 155), -62, 92);
  if (seedFlags.dimensions.co_listen_cluster === candFlags.dimensions.co_listen_cluster) {
    score += 36;
  }
  if (seedFlags.dimensions.regional_scene === candFlags.dimensions.regional_scene) {
    score += 28;
  }
  if (seedFlags.dimensions.mood_valence === candFlags.dimensions.mood_valence) {
    score += 14;
  }
  if (seedFlags.dimensions.listening_context === candFlags.dimensions.listening_context) {
    score += 12;
  }
  if (seedFlags.dimensions.rhythm_feel === candFlags.dimensions.rhythm_feel) {
    score += 14;
  }

  // Directional Popularity & Viral Momentum (Spotify-style popular hit priority over obscure B-sides)
  if (candFlags.dimensions.viral_momentum === 'chart_viral_hit') {
    score += 68;
  } else if (candFlags.dimensions.viral_momentum === 'editorial_signature') {
    score += 46;
  } else if (candFlags.dimensions.viral_momentum === 'steady_popular') {
    score += 18;
  }

  if (candFlags.dimensions.popularity_tier === 'global_mega_hit') {
    score += 26;
  } else if (candFlags.dimensions.popularity_tier === 'mainstream_hit') {
    score += 18;
  } else if (candFlags.dimensions.popularity_tier === 'regional_popular') {
    score += 6;
  } else if (
    candFlags.dimensions.popularity_tier === 'deep_cut' &&
    candFlags.dimensions.viral_momentum === 'catalog_standard'
  ) {
    score -= 38;
  }

  // Prefer clean canonical Apple Music / Deezer / Studio Master metadata over messy raw YouTube upload titles
  if (
    candFlags.dimensions.catalog_provenance === 'apple_music' ||
    candFlags.dimensions.catalog_provenance === 'deezer_global' ||
    candFlags.dimensions.catalog_provenance === 'studio_master'
  ) {
    score += 24;
  } else if (
    candFlags.dimensions.catalog_provenance === 'youtube_music' &&
    (/\b(omv|mv|official\s+music|lirik|lyrics)\b/i.test(candidate.title) || candidate.title.length > 52)
  ) {
    score -= 28;
  }

  // Penalize unofficial remixes, remakes, bootleg DJ mixes, and crossover covers when seed is an original release
  const seedIsRemixOrCover =
    seedFlags.dimensions.release_format === 'remix_edit' ||
    NON_ORIGINAL_REMIX_COVER_RE.test(seedTrack.title);
  const candIsRemixOrCover =
    candFlags.dimensions.release_format === 'remix_edit' ||
    NON_ORIGINAL_REMIX_COVER_RE.test(candidate.title) ||
    (seedClass.classId === 'indo_timur_hits' && KOPLO_CROSSOVER_ARTIST_RE.test(candidate.artist));
  if (!seedIsRemixOrCover && candIsRemixOrCover) {
    score -= 260;
  }

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
  const prevFlags =
    prevTrack.musicFlags && prevTrack.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length
      ? prevTrack.musicFlags
      : computeTrackMusicFlags(prevTrack);
  const candFlags =
    candidate.musicFlags && candidate.musicFlags.count >= MUSIC_FLAG_DIMENSIONS.length
      ? candidate.musicFlags
      : computeTrackMusicFlags(candidate);
  const flagSim = computeMultiFlagSimilarity(prevFlags, candFlags);
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
  return (sim - 0.72) * 80 + (flagSim.similarity - 0.45) * 60 + bpmBonus + clsBonus;
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
    // Hard-stop guard: never pad the queue with hard-rejected cross-language (e.g. Indian/Arabic/foreign) or duplicate-cover tracks
    if (bestScore < -220 && ordered.length > 0) {
      break;
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
  track: Pick<Track, 'title' | 'artist' | 'genre' | 'bpm'> & Partial<Pick<Track, 'album' | 'lyrics'>>,
  mood: MoodPreset = 'all',
  count = 4
): string[] {
  const seedPrimary = extractPrimaryArtist(track.artist);
  const classProfile = classifyTrackTier(track);
  const seedLang = inferTrackLanguageRegion(track);
  const seedHash = Math.floor(hashPair(track.artist || 'artist', track.title || 'title') * 100);

  // Eastern Indonesian (Hits Lagu Timur) sub-cluster hit discovery queries matching Spotify's viral Timur radio graph
  if (classProfile.classId === 'indo_timur_hits') {
    const titleLower = String(track.title || '').toLowerCase();
    const isGalauSeed =
      TIMUR_GALAU_AMBON_TITLE_RE.test(titleLower) && !TIMUR_PARTY_VIRAL_TITLE_RE.test(titleLower);
    const timurHitQueries = isGalauSeed
      ? [
          'Tamang Pung Kisah Fresly Nikijuluw',
          'Rindu Rumah Wizz Baker',
          'Bale Pulang Justy Aldrin',
          'Cinta Beda Agama Vicky Salamor',
          'Cinta Sakota Mitha Talahatu',
          'Sa Lelah Glen Sebastian',
          'Janji Putih Doddie Latuharhary',
          'Rumah Par Ale Justy Aldrin',
          'Gagal Berjuang Gihon Marel',
          'Semata Karenamu Mario G Klau'
        ]
      : [
          'TABOLA BALE Silet Open Up',
          'Pica Pica Juan Reza',
          'Stecu Stecu Faris Adam',
          'Mode Pesawat Dandy Barakati',
          'Ngapain Repot Toton Caribo',
          'Orang Baru Lebe Gacor Ecko Show',
          'Karna Su Sayang Near',
          'Jang Ganggu Shine Of Black',
          'Bale Pulang Toton Caribo',
          'Kaka Main Salah Putry Pasanea'
        ];
    const filteredHits = timurHitQueries.filter(
      (q) =>
        (!seedPrimary || !q.toLowerCase().includes(seedPrimary)) &&
        (!titleLower || !q.toLowerCase().includes(titleLower))
    );
    const chosen: string[] = [];
    const step = filteredHits.length > count ? Math.max(1, Math.floor(filteredHits.length / Math.max(1, count))) : 1;
    for (let i = 0; i < filteredHits.length && chosen.length < count; i++) {
      const q = filteredHits[(seedHash + i * step) % filteredHits.length];
      if (!chosen.includes(q)) chosen.push(q);
    }
    if (chosen.length >= count) {
      return chosen.slice(0, count);
    }
  }

  const peerPool = classProfile.peerArtists.filter(
    (name) => name.toLowerCase() !== seedPrimary && !seedPrimary.includes(name.toLowerCase())
  );

  const directorySameClass = ARTISTS_DIRECTORY.filter((entry) => {
    const norm = entry.name.toLowerCase();
    if (norm === seedPrimary || peerPool.some((p) => p.toLowerCase() === norm)) return false;
    const probe = { title: '', artist: entry.name, genre: entry.genre, bpm: track.bpm };
    if (classifyTrackTier(probe).classId !== classProfile.classId) return false;
    if (seedLang !== 'en' && seedLang !== 'instrumental') {
      return inferTrackLanguageRegion(probe) === seedLang;
    }
    return true;
  }).map((e) => e.name);

  const moodQueries =
    mood !== 'all' && (seedLang === 'en' || mood === 'indonesian') ? getMoodSeedQueries(mood) : [];

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
    const fallback = getRelatedArtistsFromDirectory(track.artist, track.genre, count * 2);
    for (const f of fallback) {
      if (result.length >= count) break;
      const probeLang = inferTrackLanguageRegion({ title: '', artist: f.name, genre: f.genre, bpm: track.bpm });
      if (
        (seedLang === 'id' || seedLang === 'hi' || seedLang === 'ar' || seedLang === 'ko' || seedLang === 'ja') &&
        probeLang !== seedLang
      ) {
        continue;
      }
      if (seedLang === 'en' && (probeLang === 'hi' || probeLang === 'ar' || probeLang === 'id' || probeLang === 'other')) {
        continue;
      }
      if (!result.includes(f.name) && f.name.toLowerCase() !== seedPrimary) {
        result.push(f.name);
      }
    }
  }

  return result.slice(0, count);
}

/**
 * Filter a candidate pool to genre-, vibe-, and language-cohesive tracks around `seedTrack`,
 * enforcing a hard language boundary so Indonesian tracks never drift to Indian/Arabic/English/foreign songs.
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

  // Hard language boundary filter applied upfront before any class matching
  const seedIsRemixOrCover = NON_ORIGINAL_REMIX_COVER_RE.test(seedTrack.title);
  const langSafePool = deduped.filter((cand) => {
    const cl = inferTrackLanguageRegion(cand);
    if (seedLang === 'instrumental') {
      return classifyTrackTier(cand).isInstrumental;
    }
    if (seedLang === 'en') {
      // English seeds never pull Indian, Arabic, Indonesian, or other unrelated non-English scripts
      return cl === 'en' || cl === 'ko' || cl === 'ja' || cl === 'es';
    }
    // Non-English seeds (Indonesian / Lagu Timur / Dangdut, Indian, Arabic, K-Pop, J-Pop, Latin) stay strictly in-language
    if (cl !== seedLang) return false;
    // Extra guard for Indonesian & Lagu Timur seeds: block pure English-titled tracks (e.g. "Stay Back", "I was lose you", "TWENTIES")
    if (seedLang === 'id' && hasPureEnglishTitleWithoutIndoSignal(cand.title)) {
      return false;
    }
    // For Eastern Indonesian hits, exclude unofficial remakes/DJ mixes/Koplo covers when seed is an original track
    if (
      seedTier.classId === 'indo_timur_hits' &&
      !seedIsRemixOrCover &&
      (NON_ORIGINAL_REMIX_COVER_RE.test(cand.title) || KOPLO_CROSSOVER_ARTIST_RE.test(cand.artist))
    ) {
      return false;
    }
    return true;
  });

  const exactClassAndLang = langSafePool.filter((cand) => {
    const ct = classifyTrackTier(cand);
    const cl = inferTrackLanguageRegion(cand);
    if (ct.classId !== seedTier.classId) return false;
    if (seedLang === 'en') return cl === 'en' || ct.classId === seedTier.classId;
    return true;
  });

  if (exactClassAndLang.length >= (seedTier.classId === 'indo_timur_hits' ? 1 : minSameLangClass)) {
    return exactClassAndLang;
  }

  const sameLangAndClass = langSafePool.filter((cand) => {
    const ct = classifyTrackTier(cand);
    const cl = inferTrackLanguageRegion(cand);
    const classOk = ct.classId === seedTier.classId || seedTier.compatibleClasses.includes(ct.classId);
    if (!classOk) return false;
    if (seedLang === 'en') {
      return cl === 'en' || ct.classId === seedTier.classId;
    }
    return true;
  });

  if (sameLangAndClass.length >= minSameLangClass) {
    return sameLangAndClass;
  }

  // Strict language lock for non-English seeds (Indonesian / Lagu Timur / Dangdut / Indian / Arabic / K-Pop / J-Pop):
  // NEVER leak Indian, English, or other-language tracks into an Indonesian queue.
  if (seedLang !== 'en' && seedLang !== 'instrumental') {
    if (langSafePool.length > 0) {
      return sameLangAndClass.length > 0
        ? [...sameLangAndClass, ...langSafePool.filter((c) => !sameLangAndClass.some((s) => s.id === c.id))]
        : langSafePool;
    }
    return [];
  }

  const englishStrict = langSafePool.filter((cand) => inferTrackLanguageRegion(cand) === 'en');
  const compatibleClassPool = langSafePool.filter((cand) => {
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

  if (seedLang === 'en' && englishStrict.length > 0) {
    return englishStrict;
  }

  return langSafePool;
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

