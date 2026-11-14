export interface IndexedArtist {
  name: string;
  genre: string;
}

const RAW_ARTISTS_BY_GENRE: Record<string, string[]> = {
  Pop: [
    'Taylor Swift', 'Bruno Mars', 'Adele', 'Ed Sheeran', 'Billie Eilish', 'Dua Lipa',
    'Ariana Grande', 'Justin Bieber', 'Harry Styles', 'Olivia Rodrigo', 'Sabrina Carpenter',
    'Lady Gaga', 'Katy Perry', 'Rihanna', 'Beyonce', 'Miley Cyrus', 'Selena Gomez',
    'Shawn Mendes', 'Charlie Puth', 'Camila Cabello', 'Sia', 'P!nk', 'Christina Aguilera',
    'Britney Spears', 'Justin Timberlake', 'Madonna', 'Michael Jackson', 'Whitney Houston',
    'Celine Dion', 'Mariah Carey', 'Kylie Minogue', 'Robbie Williams', 'Elton John',
    'Billy Joel', 'George Michael', 'Prince', 'Phil Collins', 'Lionel Richie',
    'Stevie Wonder', 'Janet Jackson', 'Cher', 'Cyndi Lauper', 'Kelly Clarkson',
    'Carly Rae Jepsen', 'Lorde', 'Charli XCX', 'Troye Sivan', 'Halsey', 'Bebe Rexha',
    'Ava Max', 'Anne-Marie', 'Zara Larsson', 'Mabel', 'Ellie Goulding', 'Jessie J',
    'Rita Ora', 'Demi Lovato', 'Jonas Brothers', 'One Direction', 'ZAYN', 'Liam Payne',
    'Niall Horan', 'Louis Tomlinson', 'Sam Smith', 'Lewis Capaldi', 'Calum Scott',
    'James Arthur', 'Dean Lewis', 'Tom Walker', 'George Ezra', 'Vance Joy',
    'Shawn Colvin', 'Jason Mraz', 'John Mayer', 'Sara Bareilles', 'Colbie Caillat',
    'Natasha Bedingfield', 'Nelly Furtado', 'Fergie', 'Gwen Stefani', 'Kelly Rowland',
    'Nicole Scherzinger', 'Pussycat Dolls', 'Spice Girls', 'Backstreet Boys', 'NSYNC',
    'Westlife', 'Boyzone', 'Blue', 'Take That', 'ABBA', 'Roxette', 'Ace of Base',
    'A-ha', 'Benson Boone', 'Teddy Swims', 'Chappell Roan', 'Tate McRae', 'Gracie Abrams',
    'Conan Gray', 'Reneé Rapp', 'Madison Beer', 'Maisie Peters', 'Laufey', 'Meghan Trainor',
    'Lizzo', 'Doja Cat', 'Lukas Graham', 'OneRepublic', 'Maroon 5', 'The Script',
    'Train', 'Daughtry', 'Jordin Sparks', 'Kehlani', 'Lauv', 'Jeremy Zucker', 'Chelsea Cutler',
    'Alec Benjamin', 'Sasha Alex Sloan', 'Bazzi', 'MAX', 'AJR', 'Why Don\'t We'
  ],
  Rock: [
    'Queen', 'The Beatles', 'The Rolling Stones', 'Led Zeppelin', 'Pink Floyd', 'AC/DC',
    'Nirvana', 'Foo Fighters', 'Linkin Park', 'Coldplay', 'Imagine Dragons', 'Green Day',
    'U2', 'Guns N\' Roses', 'Bon Jovi', 'Aerosmith', 'Eagles', 'Fleetwood Mac',
    'David Bowie', 'The Doors', 'Jimi Hendrix', 'The Who', 'Cream', 'Deep Purple',
    'Black Sabbath', 'Van Halen', 'Def Leppard', 'Journey', 'Foreigner', 'Toto',
    'Boston', 'Kansas', 'Lynyrd Skynyrd', 'Creedence Clearwater Revival', 'Tom Petty',
    'Bruce Springsteen', 'Bob Dylan', 'Dire Straits', 'The Police', 'Sting', 'R.E.M.',
    'The Cure', 'Depeche Mode', 'Tears for Fears', 'Duran Duran', 'INXS', 'Oasis',
    'Blur', 'Radiohead', 'Muse', 'The Verve', 'Pulp', 'Arctic Monkeys', 'The Strokes',
    'The Killers', 'Franz Ferdinand', 'Interpol', 'Kings of Leon', 'Red Hot Chili Peppers',
    'Pearl Jam', 'Soundgarden', 'Alice in Chains', 'Stone Temple Pilots', 'Smashing Pumpkins',
    'Weezer', 'Blink-182', 'Sum 41', 'Simple Plan', 'My Chemical Romance', 'Fall Out Boy',
    'Panic! At The Disco', 'Paramore', 'Evanescence', 'Nickelback', 'Three Days Grace',
    'Breaking Benjamin', 'Skillet', 'Starset', 'Twenty One Pilots', 'Incubus', 'Audioslave',
    'Rage Against the Machine', 'Queens of the Stone Age', 'The White Stripes', 'Jack White',
    'Maneskin', 'Greta Van Fleet', 'Cage The Elephant', 'Foster The People', 'Vampire Weekend',
    'Phoenix', 'Two Door Cinema Club', 'Keane', 'Snow Patrol', 'The Fray', 'Matchbox Twenty',
    'Goo Goo Dolls', '3 Doors Down', 'Hoobastank', 'Lifehouse', 'Switchfoot', 'Counting Crows',
    'Bad Company', 'Scorpions', 'Europe', 'Whitesnake', 'Kiss', 'Rush', 'Yes', 'Genesis'
  ],
  'Hip-Hop': [
    'Eminem', 'Drake', 'Kendrick Lamar', 'Post Malone', 'Travis Scott', 'Kanye West',
    'Jay-Z', 'Nas', 'Tupac Shakur', 'The Notorious B.I.G.', 'Snoop Dogg', 'Dr. Dre',
    '50 Cent', 'Ice Cube', 'OutKast', 'Lil Wayne', 'Nicki Minaj', 'Cardi B',
    'Megan Thee Stallion', 'J. Cole', 'Tyler, The Creator', 'ASAP Rocky', 'Future',
    '21 Savage', 'Metro Boomin', 'Playboi Carti', 'Lil Uzi Vert', 'Juice WRLD',
    'XXXTENTACION', 'Lil Peep', 'Mac Miller', 'Logic', 'NF', 'G-Eazy',
    'Machine Gun Kelly', 'Wiz Khalifa', 'Swae Lee', 'Rae Sremmurd', 'Migos',
    'Offset', 'Quavo', 'Takeoff', 'Young Thug', 'Gunna', 'Lil Baby',
    'DaBaby', 'Roddy Ricch', 'Pop Smoke', 'Jack Harlow', 'Central Cee', 'Stormzy',
    'Skepta', 'Dave', 'Aitch', 'Bugzy Malone', 'Macklemore', 'Pitbull',
    'Flo Rida', 'Black Eyed Peas', 'will.i.am', 'Pharrell Williams', 'Timbaland',
    'Missy Elliott', 'Busta Rhymes', 'Ludacris', 'T.I.', 'Nelly', 'Akon',
    'T-Pain', 'Sean Paul', 'Shaggy', 'Cypress Hill', 'Wu-Tang Clan', 'Run-DMC',
    'Beastie Boys', 'Public Enemy', 'A Tribe Called Quest', 'MF DOOM', 'Denzel Curry',
    'JID', 'Joey Bada$$', 'Pusha T', 'Big Sean', 'Meek Mill', 'Rick Ross',
    'Kid Cudi', 'Vince Staples', 'Earl Sweatshirt', 'Brockhampton', 'Run The Jewels',
    'Yeat', 'Don Toliver', 'Baby Keem', 'Ice Spice', 'Latto', 'GloRilla',
    'Rich Brian', 'Warren Hue', 'NIKI', 'Joji', '88rising'
  ],
  'R&B': [
    'The Weeknd', 'Frank Ocean', 'SZA', 'Usher', 'Alicia Keys', 'John Legend',
    'Ne-Yo', 'Chris Brown', 'Trey Songz', 'Jason Derulo', 'Khalid', 'H.E.R.',
    'Daniel Caesar', 'Giveon', 'Brent Faiyaz', 'Summer Walker', 'Bryson Tiller',
    'Tory Lanez', '6LACK', 'Partynextdoor', 'Jhene Aiko', 'Kiana Lede', 'Ella Mai',
    'Mahalia', 'Jorja Smith', 'Cleo Sol', 'Victoria Monet', 'Tyla', 'Rema',
    'Burna Boy', 'Wizkid', 'Davido', 'Tems', 'Ayra Starr', 'Omah Lay',
    'Ckay', 'Fireboy DML', 'Miguel', 'Anderson .Paak', 'Silk Sonic', 'Leon Bridges',
    'Steve Lacy', 'Omar Apollo', 'Kali Uchis', 'Chloe x Halle', 'Halle',
    'Ari Lennox', 'Masego', 'FKJ', 'Lucky Daye', 'SiR', 'Snoh Aalegra',
    'Jessie Reyez', 'Sabrina Claudio', 'Alina Baraz', 'Tinashe',
    'Ciara', 'Ashanti', 'Monica', 'Brandy', 'Aaliyah', 'TLC',
    'Destiny\'s Child', 'Mary J. Blige', 'Lauryn Hill', 'Erykah Badu', 'D\'Angelo',
    'Maxwell', 'Toni Braxton', 'Boyz II Men', 'Marvin Gaye', 'Otis Redding',
    'Aretha Franklin', 'Sam Cooke', 'Al Green', 'Bill Withers', 'Luther Vandross',
    'Ray Charles', 'James Brown', 'Earth, Wind & Fire', 'Kool & The Gang', 'Chaka Khan'
  ],
  EDM: [
    'Daft Punk', 'Calvin Harris', 'David Guetta', 'Avicii', 'Martin Garrix', 'Marshmello',
    'Alan Walker', 'Kygo', 'Zedd', 'Tiesto', 'Armin van Buuren', 'Hardwell',
    'Afrojack', 'Dimitri Vegas & Like Mike', 'Nicky Romero', 'Steve Aoki', 'Skrillex',
    'Diplo', 'Major Lazer', 'DJ Snake', 'The Chainsmokers', 'Illenium', 'Gryffin',
    'Porter Robinson', 'Madeon', 'Odesza', 'Flume', 'Disclosure', 'Fred again..',
    'Peggy Gou', 'Fisher', 'Chris Lake', 'Dom Dolla', 'John Summit', 'Carl Cox',
    'Charlotte de Witte', 'Amelie Lens', 'Boris Brejcha', 'Deadmau5', 'Eric Prydz',
    'Swedish House Mafia', 'Axwell', 'Sebastian Ingrosso', 'Steve Angello', 'Alesso',
    'Galantis', 'Robin Schulz', 'Lost Frequencies', 'Jonas Blue', 'Sigala',
    'Clean Bandit', 'Rudimental', 'Jax Jones', 'Joel Corry', 'MEDUZA',
    'James Hype', 'Purple Disco Machine', 'Kaytranada', 'Jamie xx', 'Four Tet',
    'Caribou', 'Bonobo', 'Tycho', 'RUFUS DU SOL', 'Zhu', 'Rezz',
    'Excision', 'Subtronics', 'Slander', 'Seven Lions', 'Said The Sky', 'San Holo',
    'R3HAB', 'KSHMR', 'Don Diablo', 'Oliver Heldens', 'Tchami', 'Malaa',
    'Vini Vici', 'Infected Mushroom', 'Above & Beyond', 'Paul van Dyk', 'Ferry Corsten',
    'Gareth Emery', 'Dash Berlin', 'W&W', 'Showtek', 'Dvbbs', 'Deorro'
  ],
  'K-Pop': [
    'BTS', 'BLACKPINK', 'NewJeans', 'Stray Kids', 'TWICE', 'SEVENTEEN',
    'EXO', 'NCT 127', 'NCT DREAM', 'aespa', 'IVE', 'LE SSERAFIM',
    'ITZY', 'TXT', 'ENHYPEN', 'ATEEZ', 'Red Velvet', 'BIGBANG',
    'G-DRAGON', 'TAEYANG', 'PSY', '2NE1', 'Girls\' Generation', 'Taeyeon',
    'IU', 'SUNMI', 'CHUNG HA', 'Hwasa', 'MAMAMOO', '(G)I-DLE',
    'OH MY GIRL', 'STAYC', 'NMIXX', 'BABYMONSTER', 'ILLIT', 'RIIZE',
    'ZEROBASEONE', 'BOYNEXTDOOR', 'TREASURE', 'MONSTA X', 'GOT7', 'Jackson Wang',
    'SHINee', 'SUPER JUNIOR', 'TVXQ!', '2PM', 'DAY6', 'The Rose',
    'KARD', 'AKMU', 'ZICO', 'Crush', 'Dean', 'Jay Park',
    'BIBI', 'LeeHi', 'Heize', 'Epik High', 'Paul Kim', 'Sung Si Kyung',
    'Jungkook', 'V', 'Jimin', 'SUGA', 'RM', 'j-hope',
    'Jin', 'JENNIE', 'ROSÉ', 'LISA', 'JISOO', 'KISS OF LIFE'
  ],
  'J-Pop': [
    'YOASOBI', 'Kenshi Yonezu', 'Ado', 'Official HIGE DANDism', 'King Gnu', 'Fujii Kaze',
    'Yorushika', 'Eve', 'ZUTOMAYO', 'Vaundy', 'Mrs. GREEN APPLE', 'back number',
    'ONE OK ROCK', 'RADWIMPS', 'BUMP OF CHICKEN', 'ASIAN KUNG-FU GENERATION', 'LiSA',
    'Aimer', 'Uru', 'milet', 'Hikaru Utada', 'Namy', 'Ringo Sheena', 'Perfume',
    'BABYMETAL', 'BAND-MAID', 'SCANDAL', 'MAN WITH A MISSION', 'FLOW', 'SPYAIR',
    'UVERworld', 'L\'Arc-en-Ciel', 'X JAPAN', 'B\'z', 'Mr.Children', 'Spitz',
    'Southern All Stars', 'Yumi Matsutoya', 'Tatsuro Yamashita', 'Mariya Takeuchi',
    'Anri', 'Miki Matsubara', 'Taeko Onuki', 'Toshiki Kadomatsu', 'Casiopea', 'T-SQUARE',
    'Nujabes', 'Kensuke Ushio', 'Hiroyuki Sawano', 'Joe Hisaishi', 'Ryuichi Sakamoto',
    'Yuki Kajiura', 'Yoko Kanno', 'Masayuki Suzuki', 'Creepy Nuts', 'Atarashii Gakko!',
    'imase', 'tuki.', 'KANA-BOON', 'Frederic', 'Polkadot Stingray', 'Kenshi',
    'Gen Hoshino', 'Aimyon', 'Sakanaction', 'Sekai no Owari', 'YUI', 'Ayumi Hamasaki',
    'Koda Kumi', 'Namie Amuro', 'Arashi', 'SMAP', 'Kyary Pamyu Pamyu'
  ],
  Indonesian: [
    'Tulus', 'Hindia', 'Dewa 19', 'Sheila On 7', 'Noah', 'Peterpan',
    'Nadin Amizah', 'Pamungkas', 'Sal Priadi', 'Kunto Aji', 'Fiersa Besari', 'Iwan Fals',
    'Chrisye', 'Glenn Fredly', 'Raisa', 'Isyana Sarasvati', 'Yura Yunita', 'Bernadya',
    'Mahalini', 'Tiara Andini', 'Lyodra', 'Ziva Magnolya', 'Nabila Taqiyyah', 'Rony Parulian',
    'Salma Salsabil', 'Rizky Febian', 'Juicy Luicy', 'For Revenge', 'Last Child', 'Virgoun',
    'Budi Doremi', 'Judika', 'Afgan', 'Melly Goeslaw', 'Rossa', 'Bunga Citra Lestari',
    'Agnez Mo', 'Cinta Laura', 'Maudy Ayunda', 'Feby Putri', 'Dere', 'Idgitaf',
    'Reality Club', 'Efek Rumah Kaca', 'Payung Teduh', 'Fourtwnty', 'Banda Neira',
    'Dialog Dini Hari', 'Stars and Rabbit', 'Barasuara', 'Maliq & D\'Essentials',
    'RAN', 'HIVI!', 'GAC', 'Kahitmen', 'Kahitna', 'Yovie & Nuno',
    'Ada Band', 'Padi', 'Gigi', 'Slank', 'Ungu', 'Nidji',
    'D\'Masiv', 'Wali', 'ST12', 'Letto', 'Kotak', 'Armada',
    'Repvblik', 'Kangen Band', 'Seventeen', 'Drive', 'Samsons', 'Kerispatih',
    'Dandy Barakati', 'Denny Caknan', 'Happy Asmara', 'NDX A.K.A.', 'Guyon Waton',
    'Tipe-X', 'Superman Is Dead', 'Burgerkill', 'Seringai', 'The Adams'
  ],
  Latin: [
    'Bad Bunny', 'J Balvin', 'Shakira', 'Karol G', 'Daddy Yankee', 'Maluma',
    'Ozuna', 'Rauw Alejandro', 'Feid', 'Peso Pluma', 'Rosalia', 'Luis Fonsi',
    'Enrique Iglesias', 'Ricky Martin', 'Marc Anthony', 'Romeo Santos', 'Aventura',
    'Becky G', 'Anitta', 'Natti Natasha', 'Farruko', 'Nicky Jam', 'Wisin & Yandel',
    'Don Omar', 'Tego Calderon', 'Calle 13', 'Residente', 'Camilo', 'Sebastian Yatra',
    'Morat', 'Mana', 'Soda Stereo', 'Juanes', 'Carlos Vives', 'Selena',
    'Gloria Estefan', 'Celia Cruz', 'Juan Gabriel', 'Luis Miguel', 'Christian Nodal',
    'Fuerza Regida', 'Grupo Frontera', 'Eslabon Armado', 'Natanael Cano', 'Myke Towers',
    'Eladio Carrion', 'Arcangel', 'Mora', 'Quevedo', 'Bizarrap', 'Duki'
  ],
  'Jazz & Soul': [
    'Miles Davis', 'John Coltrane', 'Louis Armstrong', 'Ella Fitzgerald', 'Billie Holiday',
    'Nina Simone', 'Frank Sinatra', 'Nat King Cole', 'Tony Bennett', 'Chet Baker',
    'Duke Ellington', 'Count Basie', 'Charlie Parker', 'Dizzy Gillespie', 'Thelonious Monk',
    'Dave Brubeck', 'Herbie Hancock', 'Chick Corea', 'Pat Metheny', 'Keith Jarrett',
    'Kamasi Washington', 'Robert Glasper', 'Thundercat', 'Snarky Puppy', 'Esperanza Spalding',
    'Norah Jones', 'Diana Krall', 'Michael Buble', 'Jamie Cullum', 'Gregory Porter',
    'Samara Joy', 'Etta James', 'Amy Winehouse', 'Celeste', 'Paloma Faith',
    'Corinne Bailey Rae', 'Sade', 'Barry White', 'Isaac Hayes', 'Curtis Mayfield',
    'B.B. King', 'Muddy Waters', 'Eric Clapton', 'John Lee Hooker', 'Robert Johnson',
    'Stevie Ray Vaughan', 'Gary Moore', 'Joe Bonamassa', 'Beth Hart', 'George Benson'
  ],
  Metal: [
    'Metallica', 'Iron Maiden', 'Megadeth', 'Slayer', 'Anthrax', 'Judas Priest',
    'Motorhead', 'Pantera', 'Slipknot', 'System Of A Down', 'Korn', 'Deftones',
    'Tool', 'Avenged Sevenfold', 'Disturbed', 'Five Finger Death Punch', 'Bullet For My Valentine',
    'Bring Me The Horizon', 'Architects', 'Bad Omens', 'Sleep Token', 'Spiritbox',
    'A Day To Remember', 'Motionless In White', 'Ice Nine Kills', 'Gojira', 'Mastodon',
    'Opeth', 'Dream Theater', 'Nightwish', 'Within Temptation', 'Epica',
    'Sabaton', 'Powerwolf', 'Rammstein', 'Ghost', 'Lamb of God', 'Trivium',
    'Killswitch Engage', 'As I Lay Dying', 'Amon Amarth', 'In Flames', 'Arch Enemy',
    'Children of Bodom', 'Meshuggah', 'Periphery', 'Polyphia', 'Animals As Leaders'
  ],
  Indie: [
    'Tame Impala', 'Mac DeMarco', 'Lana Del Rey', 'Mitski', 'Phoebe Bridgers', 'Clairo',
    'Boygenius', 'Lucy Dacus', 'Julien Baker', 'Beach House', 'Cigarettes After Sex',
    'The 1975', 'The Neighbourhood', 'Chase Atlantic', 'Foster The People', 'Glass Animals',
    'Alt-J', 'Metronomy', 'MGMT', 'Empire Of The Sun', 'Passion Pit', 'M83',
    'Chvrches', 'Purity Ring', 'Grimes', 'Caroline Polachek', 'Weyes Blood',
    'Japanese Breakfast', 'Beabadoobee', 'Men I Trust', 'Faye Webster', 'Rex Orange County',
    'Cuco', 'Girl in Red', 'Cavetown', 'Wallows', 'Dayglow', 'Coin',
    'Hippo Campus', 'Declan McKenna', 'Inhaler', 'Fontaines D.C.', 'Wet Leg',
    'Khruangbin', 'Parcels', 'Jungle', 'L\'Imperatrice', 'Toro y Moi', 'Washed Out',
    'Bon Iver', 'Fleet Foxes', 'Iron & Wine', 'Sufjan Stevens', 'Elliott Smith',
    'Lord Huron', 'The Lumineers', 'Mumford & Sons', 'Of Monsters and Men', 'Florence + The Machine',
    'Hozier', 'Noah Kahan', 'Matt Maltese', 'd4vd', 'Djo', 'Stephen Sanchez'
  ]
};

// Build deduplicated global catalog of 800+ unique popular artists
const seenNames = new Set<string>();
export const ARTISTS_DIRECTORY: IndexedArtist[] = [];

for (const [genre, names] of Object.entries(RAW_ARTISTS_BY_GENRE)) {
  for (const name of names) {
    const norm = name.trim();
    const key = norm.toLowerCase();
    if (norm && !seenNames.has(key)) {
      seenNames.add(key);
      ARTISTS_DIRECTORY.push({ name: norm, genre });
    }
  }
}

// Supplement verified international pop, country, classical, reggae, and global icons to ensure >= 800 artists
const EXTRA_POPULAR_ARTISTS: Array<[string, string]> = [
  ['Johnny Cash', 'Country'], ['Dolly Parton', 'Country'], ['Willie Nelson', 'Country'],
  ['Morgan Wallen', 'Country'], ['Luke Combs', 'Country'], ['Zach Bryan', 'Country'],
  ['Chris Stapleton', 'Country'], ['Shania Twain', 'Country'], ['Miranda Lambert', 'Country'],
  ['Carrie Underwood', 'Country'], ['Keith Urban', 'Country'], ['Tim McGraw', 'Country'],
  ['Blake Shelton', 'Country'], ['Kenny Rogers', 'Country'], ['Garth Brooks', 'Country'],
  ['Kacey Musgraves', 'Country'], ['Brad Paisley', 'Country'], ['Alan Jackson', 'Country'],
  ['Bob Marley', 'Reggae'], ['Damian Marley', 'Reggae'], ['Ziggy Marley', 'Reggae'],
  ['UB40', 'Reggae'], ['Inner Circle', 'Reggae'], ['Rebelution', 'Reggae'],
  ['Ludovico Einaudi', 'Classical'], ['Max Richter', 'Classical'], ['Hans Zimmer', 'Soundtrack'],
  ['John Williams', 'Soundtrack'], ['Ramin Djawadi', 'Soundtrack'], ['Howard Shore', 'Soundtrack'],
  ['Ennio Morricone', 'Soundtrack'], ['Thomas Bergersen', 'Soundtrack'], ['Two Steps from Hell', 'Soundtrack'],
  ['Yiruma', 'Classical'], ['Lang Lang', 'Classical'], ['Yo-Yo Ma', 'Classical'],
  ['Andrea Bocelli', 'Classical'], ['Luciano Pavarotti', 'Classical'], ['Sarah Brightman', 'Classical'],
  ['Josh Groban', 'Classical'], ['Il Divo', 'Classical'], ['2CELLOS', 'Classical'],
  ['Lindsey Stirling', 'Classical'], ['Pentatonix', 'Pop'], ['Celtic Woman', 'Folk'],
  ['Simon & Garfunkel', 'Folk'], ['Joni Mitchell', 'Folk'], ['Cat Stevens', 'Folk'],
  ['Neil Young', 'Folk'], ['James Taylor', 'Folk'], ['Tracy Chapman', 'Folk'],
  ['John Denver', 'Folk'], ['Ben Howard', 'Folk'], ['Passenger', 'Folk'],
  ['Kodaline', 'Indie'], ['Tom Odell', 'Indie'], ['Birdy', 'Indie'],
  ['Daughter', 'Indie'], ['London Grammar', 'Indie'], ['The xx', 'Indie'],
  ['James Blake', 'Indie'], ['FKA twigs', 'Indie'], ['Rina Sawayama', 'Pop'],
  ['Kim Petras', 'Pop'], ['Tove Lo', 'Pop'], ['MØ', 'Pop'],
  ['AURORA', 'Indie'], ['Sigrid', 'Pop'], ['Dagny', 'Pop'],
  ['Kaskade', 'EDM'], ['Benny Benassi', 'EDM'],
  ['Darude', 'EDM'], ['Gigi D\'Agostino', 'EDM'], ['Eiffel 65', 'EDM'],
  ['Cascada', 'EDM'], ['Basshunter', 'EDM'], ['Scooter', 'EDM'],
  ['Faithless', 'EDM'], ['The Prodigy', 'EDM'], ['The Chemical Brothers', 'EDM'],
  ['Fatboy Slim', 'EDM'], ['Moby', 'EDM'], ['Massive Attack', 'EDM'],
  ['Portishead', 'Indie'], ['Bjork', 'Indie'], ['Aphex Twin', 'EDM'],
  ['Boards of Canada', 'EDM'], ['Justice', 'EDM'], ['Kavinsky', 'EDM'],
  ['Carpenter Brut', 'EDM'], ['Perturbator', 'EDM'], ['The Midnight', 'EDM'],
  ['Gunship', 'EDM'], ['Timecop1983', 'EDM'], ['FM-84', 'EDM'],
  ['A.R. Rahman', 'Global'], ['Arijit Singh', 'Global'], ['Shreya Ghoshal', 'Global'],
  ['Atif Aslam', 'Global'], ['Diljit Dosanjh', 'Global'], ['Badshah', 'Global'],
  ['AP Dhillon', 'Global'], ['Shubh', 'Global'], ['Siddhu Moose Wala', 'Global'],
  ['Siti Nurhaliza', 'Global'], ['Yuna', 'Global'], ['Sheila Majid', 'Global'],
  ['Anuar Zain', 'Global'], ['Faizal Tahir', 'Global'], ['ben&ben', 'Global'],
  ['SB19', 'Global'], ['BINI', 'Global'], ['Moira Dela Torre', 'Global'],
  ['Zack Tabudlo', 'Global'], ['Jeff Satur', 'Global'], ['Bright Vachirawit', 'Global'],
  ['PP Krit', 'Global'], ['Bowkylion', 'Global'], ['Tilly Birds', 'Global'],
  ['Three Man Down', 'Global'], ['Cocktail', 'Global'], ['Bodyslam', 'Global'],
  ['Stromae', 'Pop'], ['Indila', 'Pop'], ['Zaz', 'Pop'],
  ['GIMS', 'Hip-Hop'], ['Aya Nakamura', 'Pop'], ['Angèle', 'Pop'],
  ['Mylène Farmer', 'Pop'], ['Zaho', 'Pop'],
  ['Edith Piaf', 'Jazz & Soul'], ['Charles Aznavour', 'Jazz & Soul'], ['Johnny Hallyday', 'Rock'],
  ['Helena Paparizou', 'Pop'], ['Tarkan', 'Pop'], ['Amr Diab', 'Global'],
  ['Nancy Ajram', 'Global'], ['Elissa', 'Global'], ['Fairuz', 'Global'],
  ['Aitana', 'Pop'], ['Lola Indigo', 'Pop'], ['Melendi', 'Latin'],
  ['C. Tangana', 'Latin'], ['Alejandro Sanz', 'Latin'], ['Pablo Alboran', 'Latin'],
  ['Serrat', 'Latin'], ['Mecano', 'Pop'], ['Hombres G', 'Rock'],
  ['Los Angeles Azules', 'Latin'], ['Natalia Lafourcade', 'Latin'], ['Mon Laferte', 'Latin'],
  ['Gustavo Cerati', 'Rock'], ['Charly Garcia', 'Rock'], ['Fito Paez', 'Rock'],
  ['Caetano Veloso', 'Latin'], ['Gilberto Gil', 'Latin'], ['Seu Jorge', 'Latin'],
  ['Tom Jobim', 'Jazz & Soul'], ['Joao Gilberto', 'Jazz & Soul'], ['Marisa Monte', 'Latin']
];

for (const [name, genre] of EXTRA_POPULAR_ARTISTS) {
  const norm = name.trim();
  const key = norm.toLowerCase();
  if (norm && !seenNames.has(key)) {
    seenNames.add(key);
    ARTISTS_DIRECTORY.push({ name: norm, genre });
  }
}

export const ARTIST_GENRE_CATEGORIES = [
  'All Genres',
  ...Array.from(new Set(ARTISTS_DIRECTORY.map((a) => a.genre)))
];
