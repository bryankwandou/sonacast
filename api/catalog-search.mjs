const BLOCKED_MODIFIER_REGEX =
  /\b(karaoke|8d\s+audio|nightcore|slowed(?:\s*\+\s*|\s+)reverb|sped\s+up|ringtone|parody|backing\s+track|music\s+box|lullaby|8-bit|10\s+hours?|1\s+hour|extended\s+mix)\b/i;
const PAREN_COVER_OR_REMIX_REGEX =
  /(?:[([]\s*(?:cover|remix|karaoke|instrumental|tribute|slowed|reverb|sped\s*up|nightcore|8d|loop)\b|\b(?:acoustic|piano|guitar|vocal|drum)\s+cover\b|\bcover\s+(?:by|version)\b|\btribute\s+to\b)/i;

function normalizeText(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isNonOriginalTitle(title, queryLower) {
  const lower = String(title || '').toLowerCase();
  if (BLOCKED_MODIFIER_REGEX.test(lower)) {
    const matched = lower.match(BLOCKED_MODIFIER_REGEX)?.[1] || '';
    if (matched && !queryLower.includes(matched.toLowerCase())) {
      return true;
    }
  }
  if (PAREN_COVER_OR_REMIX_REGEX.test(lower)) {
    if (!queryLower.includes('cover') && !queryLower.includes('remix') && !queryLower.includes('instrumental') && !queryLower.includes('loop')) {
      return true;
    }
  }
  return false;
}

function mapDeezerTrack(t, fromArtistTop, genreHint = 'Pop') {
  const coverUrl =
    t?.album?.cover_big ||
    t?.album?.cover_xl ||
    (t?.md5_image ? `https://cdn-images.dzcdn.net/images/cover/${t.md5_image}/500x500-000000-80-0-0.jpg` : '');

  return {
    id: `dz-${t.id}`,
    title: t.title || t.title_short || '',
    artist: t.artist?.name || '',
    album: t.album?.title || 'Single',
    genre: genreHint || t?.genres?.data?.[0]?.name || 'Pop',
    duration: Number(t.duration) || 210,
    coverUrl,
    deezerRank: Number(t.rank) || 0,
    fromArtistTop: Boolean(fromArtistTop)
  };
}

async function fetchDeezerArtistTop(artistId) {
  const res = await fetch(`https://api.deezer.com/artist/${encodeURIComponent(String(artistId))}/top?limit=50`, {
    signal: AbortSignal.timeout(3500)
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return Array.isArray(res?.data) ? res.data : [];
}

async function fetchAppleRssWithDurations(country, limit) {
  const rssUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`;
  const res = await fetch(rssUrl, { signal: AbortSignal.timeout(3800) });
  if (!res.ok) return [];
  const json = await res.json();
  const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];

  const parsed = entries.map((e, idx) => {
    const id = e?.id?.attributes?.['im:id'] || `${country}-${idx}`;
    const images = Array.isArray(e?.['im:image']) ? e['im:image'] : [];
    const rawCover = images[images.length - 1]?.label || '';
    return {
      itunesId: String(id),
      title: e?.['im:name']?.label || '',
      artist: e?.['im:artist']?.label || '',
      album: e?.['im:collection']?.['im:name']?.label || 'Single',
      genre: e?.category?.attributes?.label || 'Pop',
      coverUrl: rawCover,
      chartPos: idx + 1
    };
  }).filter((x) => x.title && x.artist && !isNonOriginalTitle(x.title, ''));

  const numericIds = parsed
    .map((p) => p.itunesId)
    .filter((id) => /^\d+$/.test(id))
    .slice(0, 30);

  const durationMap = new Map();
  const artworkMap = new Map();
  if (numericIds.length > 0) {
    try {
      const lookupRes = await fetch(
        `https://itunes.apple.com/lookup?id=${numericIds.join(',')}&country=${country}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        for (const item of lookupData?.results || []) {
          if (item?.trackId) {
            if (item.trackTimeMillis) {
              durationMap.set(String(item.trackId), Math.round(item.trackTimeMillis / 1000));
            }
            if (item.artworkUrl100) {
              artworkMap.set(String(item.trackId), item.artworkUrl100.replace('100x100bb', '600x600bb'));
            }
          }
        }
      }
    } catch {
      // Keep RSS artwork & default duration fallback if batch lookup times out
    }
  }

  return parsed
    .map((p) => ({
      id: `rss-${country}-${p.itunesId}`,
      title: p.title,
      artist: p.artist,
      album: p.album,
      genre: p.genre,
      duration: durationMap.get(p.itunesId) || 210,
      coverUrl: artworkMap.get(p.itunesId) || p.coverUrl,
      chartPos: p.chartPos
    }))
    .filter((x) => x.duration >= 60 && x.duration <= 1800);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const mode = typeof req.query?.mode === 'string' ? req.query.mode.trim() : '';

  if (mode === 'albums') {
    const rawQuery = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      res.status(400).json({ albums: [] });
      return;
    }
    try {
      const [dzRes, itRes] = await Promise.all([
        fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(rawQuery)}&limit=18`, {
          signal: AbortSignal.timeout(4500)
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(rawQuery)}&entity=album&limit=12`,
          { signal: AbortSignal.timeout(4500) }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const albums = [];
      const seen = new Set();
      const noiseRe = /\b(karaoke|8-bit|ringtone|lullaby|tribute to|made famous by|cover version)\b/i;

      const dzRows = Array.isArray(dzRes?.data) ? dzRes.data : [];
      for (const a of dzRows) {
        const title = String(a?.title || '').trim();
        const artist = String(a?.artist?.name || '').trim();
        if (!title || !artist || noiseRe.test(`${title} ${artist}`)) continue;
        const dedupKey = `${title.toLowerCase()}::${artist.toLowerCase()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        albums.push({
          id: String(a.id),
          title,
          artist,
          coverUrl: a.cover_xl || a.cover_big || a.cover_medium || '',
          nbTracks: Number(a.nb_tracks) || 0,
          recordType: String(a.record_type || 'album')
        });
      }

      const itRows = Array.isArray(itRes?.results) ? itRes.results : [];
      for (const a of itRows) {
        const title = String(a?.collectionName || '').trim();
        const artist = String(a?.artistName || '').trim();
        if (!title || !artist || noiseRe.test(`${title} ${artist}`)) continue;
        const dedupKey = `${title.toLowerCase()}::${artist.toLowerCase()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        albums.push({
          id: `it-${a.collectionId}`,
          title,
          artist,
          coverUrl: typeof a.artworkUrl100 === 'string' ? a.artworkUrl100.replace('100x100bb', '600x600bb') : '',
          nbTracks: Number(a.trackCount) || 0,
          releaseDate: typeof a.releaseDate === 'string' ? a.releaseDate.slice(0, 10) : undefined,
          genre: String(a.primaryGenreName || 'Album'),
          recordType: (Number(a.trackCount) || 0) <= 5 ? 'single' : 'album'
        });
      }

      const queryNorm = rawQuery.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const queryTokens = queryNorm.split(' ').filter((w) => w.length >= 2);
      const scoreAlbum = (a) => {
        let s = 0;
        const tNorm = a.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const artNorm = a.artist.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const combined = `${tNorm} ${artNorm}`;
        if (tNorm === queryNorm) s += 260;
        else if (combined.includes(queryNorm)) s += 160;
        const hits = queryTokens.filter((tok) => combined.includes(tok)).length;
        s += hits * 45;
        if (hits === queryTokens.length && queryTokens.length > 0) s += 90;
        if (a.recordType === 'album') s += 45;
        else if (a.recordType === 'ep') s += 20;
        else s -= 25;
        const cnt = a.nbTracks || 0;
        if (cnt >= 7 && cnt <= 24) s += 35;
        else if (cnt > 30) s -= 20;
        if (/various artists/i.test(a.artist)) s -= 180;
        if (/\blive at\b|\blive in\b/i.test(a.title) && !queryNorm.includes('live')) s -= 65;
        if (!a.id.startsWith('it-')) s += 15;
        return s;
      };

      albums.sort((x, y) => scoreAlbum(y) - scoreAlbum(x));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({ albums: albums.slice(0, 18) });
    } catch {
      res.status(500).json({ albums: [] });
    }
    return;
  }

  if (mode === 'album_tracks') {
    const albumId = typeof req.query?.albumId === 'string' ? req.query.albumId.trim() : '';
    if (!albumId) {
      res.status(400).json({ album: null, items: [] });
      return;
    }
    try {
      if (albumId.startsWith('it-')) {
        const numericId = albumId.slice(3).replace(/[^0-9]/g, '');
        if (!numericId) {
          res.status(400).json({ album: null, items: [] });
          return;
        }
        const itRes = await fetch(
          `https://itunes.apple.com/lookup?id=${numericId}&entity=song&limit=100`,
          { signal: AbortSignal.timeout(4800) }
        );
        const itJson = itRes.ok ? await itRes.json() : null;
        const rows = Array.isArray(itJson?.results) ? itJson.results : [];
        const col = rows.find((r) => r.wrapperType === 'collection');
        const tracks = rows
          .filter((r) => r.wrapperType === 'track' && r.trackName)
          .sort(
            (a, b) =>
              (Number(a.discNumber) || 1) - (Number(b.discNumber) || 1) ||
              (Number(a.trackNumber) || 0) - (Number(b.trackNumber) || 0)
          );
        const albumMeta = col
          ? {
              id: albumId,
              title: String(col.collectionName || ''),
              artist: String(col.artistName || ''),
              coverUrl:
                typeof col.artworkUrl100 === 'string'
                  ? col.artworkUrl100.replace('100x100bb', '600x600bb')
                  : '',
              nbTracks: Number(col.trackCount) || tracks.length,
              releaseDate: typeof col.releaseDate === 'string' ? col.releaseDate.slice(0, 10) : undefined,
              genre: String(col.primaryGenreName || 'Album')
            }
          : null;
        const items = tracks.map((t, idx) => ({
          id: `it-trk-${t.trackId || idx}`,
          title: String(t.trackName || ''),
          artist: String(t.artistName || albumMeta?.artist || ''),
          album: albumMeta?.title || String(t.collectionName || ''),
          genre: String(t.primaryGenreName || albumMeta?.genre || 'Album'),
          duration: Math.max(30, Math.round((Number(t.trackTimeMillis) || 200000) / 1000)),
          coverUrl:
            (typeof t.artworkUrl100 === 'string' ? t.artworkUrl100.replace('100x100bb', '600x600bb') : '') ||
            albumMeta?.coverUrl ||
            '',
          trackNumber: Number(t.trackNumber) || idx + 1,
          discNumber: Number(t.discNumber) || 1
        }));
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        res.status(200).json({ album: albumMeta, items });
        return;
      }

      const cleanId = albumId.replace(/[^0-9]/g, '');
      if (!cleanId) {
        res.status(400).json({ album: null, items: [] });
        return;
      }
      const dzRes = await fetch(`https://api.deezer.com/album/${cleanId}`, {
        signal: AbortSignal.timeout(4800)
      });
      if (!dzRes.ok) {
        res.status(200).json({ album: null, items: [] });
        return;
      }
      const data = await dzRes.json();
      if (!data || data.error) {
        res.status(200).json({ album: null, items: [] });
        return;
      }
      const coverUrl = data.cover_xl || data.cover_big || data.cover_medium || '';
      const albumMeta = {
        id: String(data.id || cleanId),
        title: String(data.title || ''),
        artist: String(data.artist?.name || ''),
        coverUrl,
        nbTracks: Number(data.nb_tracks) || 0,
        releaseDate: typeof data.release_date === 'string' ? data.release_date : undefined,
        genre: String(data.genres?.data?.[0]?.name || 'Album'),
        recordType: String(data.record_type || 'album')
      };
      const rawTracks = Array.isArray(data.tracks?.data) ? data.tracks.data : [];
      const sortedTracks = [...rawTracks].sort(
        (a, b) =>
          (Number(a.disk_number) || 1) - (Number(b.disk_number) || 1) ||
          (Number(a.track_position) || 0) - (Number(b.track_position) || 0)
      );
      const items = sortedTracks
        .filter((t) => Boolean(t?.title))
        .map((t, idx) => ({
          id: `dz-alb-${t.id || idx}`,
          title: String(t.title),
          artist: String(t.artist?.name || albumMeta.artist),
          album: albumMeta.title,
          genre: albumMeta.genre,
          duration: Math.max(20, Number(t.duration) || 210),
          coverUrl: coverUrl || t.album?.cover_big || '',
          trackNumber: Number(t.track_position) || idx + 1,
          discNumber: Number(t.disk_number) || 1
        }));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({ album: albumMeta, items });
    } catch {
      res.status(500).json({ album: null, items: [] });
    }
    return;
  }

  const mapDeezerPlaylist = (p) => ({
    id: `dz-pl-${p.id}`,
    title: String(p.title || '').trim(),
    creator: String(p.user?.name || p.creator?.name || 'Editorial Charts').trim(),
    coverUrl: String(p.picture_xl || p.picture_big || p.picture_medium || p.picture || ''),
    nbTracks: Number(p.nb_tracks) || 0,
    description: p.creation_date ? `Updated ${String(p.creation_date).slice(0, 10)}` : ''
  });

  if (mode === 'playlists') {
    const rawQuery = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      res.status(200).json({ playlists: [] });
      return;
    }
    try {
      const url = `https://api.deezer.com/search/playlist?q=${encodeURIComponent(rawQuery)}&limit=18`;
      const dzRes = await fetch(url, { signal: AbortSignal.timeout(4500) });
      const dzData = dzRes.ok ? await dzRes.json() : null;
      const seen = new Set();
      const playlists = [];
      for (const p of Array.isArray(dzData?.data) ? dzData.data : []) {
        const mapped = mapDeezerPlaylist(p);
        const key = `${normalizeText(mapped.title)}::${normalizeText(mapped.creator)}`;
        if (
          !mapped.title ||
          mapped.nbTracks < 6 ||
          /\b(karaoke|sfx|sound effects?|explicit)\b/i.test(mapped.title) ||
          seen.has(key)
        ) {
          continue;
        }
        seen.add(key);
        playlists.push(mapped);
      }
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({ playlists });
      return;
    } catch {
      res.status(500).json({ playlists: [] });
      return;
    }
  }

  if (mode === 'playlist_tracks') {
    const rawId = typeof req.query?.playlistId === 'string' ? req.query.playlistId.trim() : '';
    const cleanId = rawId.replace(/^dz-pl-/, '');
    if (!/^\d+$/.test(cleanId)) {
      res.status(400).json({ playlist: null, tracks: [] });
      return;
    }
    try {
      const dzRes = await fetch(`https://api.deezer.com/playlist/${cleanId}`, {
        signal: AbortSignal.timeout(4800)
      });
      if (!dzRes.ok) {
        res.status(dzRes.status).json({ playlist: null, tracks: [] });
        return;
      }
      const data = await dzRes.json();
      const rawTracks = Array.isArray(data?.tracks?.data) ? data.tracks.data : [];
      const tracks = rawTracks
        .map((t) => mapDeezerTrack(t, false))
        .filter((t) => t.title && t.artist && t.duration >= 45 && t.duration <= 1800 && !isNonOriginalTitle(t.title, ''))
        .slice(0, 45);
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({
        playlist: data?.id ? mapDeezerPlaylist(data) : null,
        tracks
      });
      return;
    } catch {
      res.status(500).json({ playlist: null, tracks: [] });
      return;
    }
  }

  if (mode === 'charts') {
    try {
      const [dzGlobal, usRss, idRss, appleUsAlbums, appleIdAlbums, dzChartAlbums, dzTopPlaylists] = await Promise.all([
        fetch('https://api.deezer.com/chart/0/tracks?limit=35', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchAppleRssWithDurations('us', 25).catch(() => []),
        fetchAppleRssWithDurations('id', 25).catch(() => []),
        fetch('https://rss.marketingtools.apple.com/api/v2/us/music/most-played/40/albums.json', {
          signal: AbortSignal.timeout(3800)
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch('https://rss.marketingtools.apple.com/api/v2/id/music/most-played/20/albums.json', {
          signal: AbortSignal.timeout(3800)
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch('https://api.deezer.com/chart/0/albums?limit=24', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch('https://api.deezer.com/search/playlist?q=Top%20Hits%20Global&limit=16', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const BLOCKED_EXPLICIT_RE = /\b(cunt|fuck|shit|shat|bitch|whore|porn|xxx|sex\s+sound)\b/i;
      const NON_MUSIC_ALBUM_RE =
        /\b(sound\s*effects?|sfx|soundtrack|original\s+motion\s+picture|bandai\s+namco|video\s+game|minecraft|karaoke|lullaby|asmr|white\s*noise|sleep\s*sounds|gorguts|obscura|magical\s+strings|cynthoni|grindcore|death\s+metal|country)\b/i;
      const RETRO_DECADE_PL_RE =
        /\b(?:top\s+hits\s+19[678]\d|best\s+of\s+hits\s+19[678]\d|christmas|xmas|natal|sleep|relaxation|meditation|calm\s+piano|study\s+lofi|chill\s+lofi|country)\b/i;
      const NICHE_CHART_GENRE_RE = /\b(country)\b/i;
      const COUNTRY_CROSSOVER_RE =
        /\b(ella\s+langley|morgan\s+wallen|luke\s+combs|zach\s+bryan|bailey\s+zimmerman|megan\s+moroney|riley\s+green|lainey\s+wilson|cody\s+johnson|tucker\s+wetmore|hudson\s+westbrook|jordan\s+davis|tyler\s+childers|chris\s+stapleton|jason\s+aldean|kane\s+brown|dylan\s+marlowe|gavin\s+adcock|zach\s+top|choosin'\s+texas)\b/i;
      const isChartExcluded = (item) =>
        NICHE_CHART_GENRE_RE.test(String(item?.genre || '')) ||
        COUNTRY_CROSSOVER_RE.test(`${item?.title || ''} ${item?.artist || ''} ${item?.album || ''}`);

      const cleanTracks = (list, defaultGenre) => {
        const seen = new Set();
        const out = [];
        for (const item of list) {
          if (!item?.title || !item?.artist) continue;
          const genreStr = String(item.genre || defaultGenre || 'Pop');
          if (NON_MUSIC_ALBUM_RE.test(`${item.title} ${item.album || ''}`)) continue;
          const k = `${normalizeText(item.title)}::${normalizeText(item.artist.split(/[,&]|ft\.?/i)[0] || '')}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ ...item, genre: genreStr });
        }
        return out;
      };

      const NON_POP_ROCK_ARTIST_RE =
        /\b(the clash|queen|nirvana|metallica|ac\/dc|linkin park|green day|radiohead|foo fighters|guns n' roses|oasis|red hot chili peppers|iron maiden|system of a down|slipknot)\b/i;
      const RAP_HIPHOP_ARTIST_RE =
        /\b(kendrick lamar|drake|lil baby|travis scott|future|eminem|21 savage|playboi carti|kanye west|offset|metro boomin|j\. cole|tyler, the creator)\b/i;
      const LATIN_ARTIST_RE =
        /\b(bad bunny|karol g|shakira|feid|rauw alejandro|j balvin|ozuna|peso pluma|maluma)\b/i;

      const inferChartTrackGenre = (item, fallback) => {
        const artistTitle = `${item?.artist || ''} ${item?.title || ''}`;
        if (NON_POP_ROCK_ARTIST_RE.test(artistTitle)) return 'Rock';
        if (RAP_HIPHOP_ARTIST_RE.test(artistTitle)) return 'Hip-Hop/Rap';
        if (LATIN_ARTIST_RE.test(artistTitle)) return 'Latin';
        return fallback || 'Pop';
      };

      const dzItems = Array.isArray(dzGlobal?.data)
        ? dzGlobal.data
            .map((t) => {
              const mapped = mapDeezerTrack(t, false, 'Pop');
              return { ...mapped, genre: inferChartTrackGenre(mapped, mapped.genre) };
            })
            .filter(
              (t) =>
                t.title &&
                t.artist &&
                t.duration >= 60 &&
                t.duration <= 1800 &&
                !isNonOriginalTitle(t.title, '') &&
                !NON_MUSIC_ALBUM_RE.test(`${t.title} ${t.album}`) &&
                !isChartExcluded(t)
            )
        : [];

      const popUsRss = usRss.filter((t) => !isChartExcluded(t));
      const globalCombined = cleanTracks([...dzItems, ...popUsRss], 'Pop');

      const rawAppleEntries = [
        ...(Array.isArray(appleUsAlbums?.feed?.results) ? appleUsAlbums.feed.results.slice(0, 28) : []),
        ...(Array.isArray(appleIdAlbums?.feed?.results) ? appleIdAlbums.feed.results.slice(0, 14) : [])
      ].filter((a) => {
        const genreNames = Array.isArray(a?.genres)
          ? a.genres.map((g) => g?.name || '').join(' ')
          : '';
        return (
          a?.id &&
          a?.name &&
          !/\b(?:single|ep)\b\s*$/i.test(String(a.name)) &&
          !BLOCKED_EXPLICIT_RE.test(`${a.name} ${a.artistName || ''}`) &&
          !NON_MUSIC_ALBUM_RE.test(`${a.name} ${a.artistName || ''} ${genreNames}`) &&
          !COUNTRY_CROSSOVER_RE.test(`${a.name} ${a.artistName || ''} ${genreNames}`)
        );
      });

      const appleIds = Array.from(new Set(rawAppleEntries.map((a) => String(a.id)))).slice(0, 32);
      const appleLookupMap = new Map();
      if (appleIds.length > 0) {
        try {
          const lkRes = await fetch(
            `https://itunes.apple.com/lookup?id=${appleIds.join(',')}`,
            { signal: AbortSignal.timeout(3200) }
          );
          if (lkRes.ok) {
            const lkJson = await lkRes.json();
            for (const row of Array.isArray(lkJson?.results) ? lkJson.results : []) {
              if (row?.collectionId) {
                appleLookupMap.set(String(row.collectionId), row);
              }
            }
          }
        } catch {
          // Safe fallback when iTunes lookup times out
        }
      }

      const normalizeAlbumBase = (title) =>
        normalizeText(
          String(title || '').replace(
            /\s*[([]\s*(?:deluxe|bonus(?:\s+track)?|expanded|complete|clean|explicit|edition|version|remaster(?:ed)?).*?[)\]]\s*$/gi,
            ''
          )
        );
      const appleAlbSeen = new Set();
      const appleAlbumList = [];
      for (const a of rawAppleEntries) {
        const lk = appleLookupMap.get(String(a.id));
        if (lk) {
          const trackCount = Number(lk.trackCount || 0);
          if (trackCount < 6) continue;
          if (lk.collectionExplicitness === 'explicit') continue;
          if (lk.collectionType && String(lk.collectionType).toLowerCase() !== 'album') continue;
        }
        const key = `${normalizeAlbumBase(a.name)}::${normalizeText(String(a.artistName || '').split(/[,&]/)[0] || '')}`;
        if (appleAlbSeen.has(key)) continue;
        appleAlbSeen.add(key);
        appleAlbumList.push({
          id: `it-${a.id}`,
          title: String(a.name || ''),
          artist: String(a.artistName || 'Various Artists'),
          coverUrl:
            typeof a.artworkUrl100 === 'string'
              ? a.artworkUrl100.replace('100x100bb', '600x600bb')
              : '',
          nbTracks: lk?.trackCount ? Number(lk.trackCount) : undefined,
          releaseDate: String(a.releaseDate || ''),
          genre: String(a.genres?.find((g) => g?.name && g.name !== 'Music')?.name || 'Pop'),
          recordType: 'album'
        });
        if (appleAlbumList.length >= 12) break;
      }

      const dzFeaturedAlbums = Array.isArray(dzChartAlbums?.data)
        ? dzChartAlbums.data
            .filter(
              (a) =>
                a?.id &&
                a?.title &&
                a.explicit_lyrics !== true &&
                (Number(a.nb_tracks || 0) === 0 || Number(a.nb_tracks) >= 6) &&
                !BLOCKED_EXPLICIT_RE.test(`${a.title} ${a.artist?.name || ''}`) &&
                !NON_MUSIC_ALBUM_RE.test(`${a.title} ${a.artist?.name || ''}`) &&
                !COUNTRY_CROSSOVER_RE.test(`${a.title} ${a.artist?.name || ''}`)
            )
            .slice(0, 10)
            .map((a) => ({
              id: `dz-alb-${a.id}`,
              title: String(a.title || ''),
              artist: String(a.artist?.name || 'Various Artists'),
              coverUrl: String(a.cover_xl || a.cover_big || a.cover_medium || a.cover || ''),
              nbTracks: Number(a.nb_tracks) || undefined,
              releaseDate: String(a.release_date || ''),
              recordType: String(a.record_type || 'album')
            }))
        : [];

      const featuredAlbums = [...appleAlbumList, ...dzFeaturedAlbums].slice(0, 16);

      const rawPlaylists = Array.isArray(dzTopPlaylists?.data) ? dzTopPlaylists.data : [];
      const plSeen = new Set();
      const featuredPlaylists = [];
      for (const p of rawPlaylists) {
        if (
          !p?.id ||
          !p?.title ||
          (Number(p.nb_tracks) || 0) < 10 ||
          BLOCKED_EXPLICIT_RE.test(String(p.title)) ||
          RETRO_DECADE_PL_RE.test(String(p.title))
        ) {
          continue;
        }
        const mappedPl = mapDeezerPlaylist(p);
        if (plSeen.has(mappedPl.id)) continue;
        plSeen.add(mappedPl.id);
        featuredPlaylists.push(mappedPl);
      }

      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({
        global: globalCombined,
        us: popUsRss.length >= 10 ? popUsRss : usRss,
        indonesia: cleanTracks(idRss, 'Pop'),
        featuredAlbums,
        featuredPlaylists
      });
      return;
    } catch {
      res.status(500).json({ global: [], us: [], indonesia: [], featuredAlbums: [], featuredPlaylists: [] });
      return;
    }
  }

  const RADIO_MIRRORS = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://all.api.radio-browser.info'
  ];

  async function fetchRadioJson(path) {
    for (const host of RADIO_MIRRORS) {
      try {
        const r = await fetch(`${host}${path}`, {
          headers: { 'User-Agent': 'SonacastWeb/1.0' },
          signal: AbortSignal.timeout(4800)
        });
        if (r.ok) return await r.json();
      } catch {
        // try next mirror
      }
    }
    return null;
  }

  if (mode === 'radio_meta') {
    const [stats, languages, countries] = await Promise.all([
      fetchRadioJson('/json/stats'),
      fetchRadioJson('/json/languages?order=stationcount&reverse=true&limit=200'),
      fetchRadioJson('/json/countries?order=stationcount&reverse=true&limit=250')
    ]);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      stats: stats && typeof stats === 'object' ? stats : { stations: 0, countries: 0, languages: 0, tags: 0 },
      languages: Array.isArray(languages) ? languages.filter((l) => l?.name && Number(l.stationcount) > 0) : [],
      countries: Array.isArray(countries) ? countries.filter((c) => c?.name && c?.iso_3166_1 && Number(c.stationcount) > 0) : []
    });
    return;
  }

  if (mode === 'radio_search') {
    const rq = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const rCountry = typeof req.query?.country === 'string' ? req.query.country.trim().toUpperCase() : '';
    const rLang = typeof req.query?.language === 'string' ? req.query.language.trim().toLowerCase() : '';
    const rTag = typeof req.query?.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
    const offset = Math.max(0, Math.min(2000, Number(req.query?.offset) || 0));
    const limit = Math.max(10, Math.min(100, Number(req.query?.limit) || 60));

    const paths = [];
    if (rLang) {
      paths.push(`/json/stations/search?language=${encodeURIComponent(rLang)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`);
    }
    if (rTag) {
      paths.push(`/json/stations/search?tag=${encodeURIComponent(rTag)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`);
    }
    if (rCountry && rCountry !== 'GLOBAL') {
      paths.push(`/json/stations/search?countrycode=${encodeURIComponent(rCountry)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`);
    }
    if (rq) {
      paths.push(
        `/json/stations/search?name=${encodeURIComponent(rq)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=45`,
        `/json/stations/search?language=${encodeURIComponent(rq)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=35`,
        `/json/stations/search?tag=${encodeURIComponent(rq)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=35`,
        `/json/stations/search?state=${encodeURIComponent(rq)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=30`,
        `/json/stations/search?country=${encodeURIComponent(rq)}&hidebroken=true&order=clickcount&reverse=true&offset=${offset}&limit=30`
      );
    }
    if (paths.length === 0) {
      paths.push(`/json/stations/search?hidebroken=true&is_https=true&order=clickcount&reverse=true&offset=${offset}&limit=${limit}`);
    }

    const batches = await Promise.allSettled(paths.map((p) => fetchRadioJson(p)));
    const seenUuid = new Set();
    const items = [];
    for (const b of batches) {
      if (b.status === 'fulfilled' && Array.isArray(b.value)) {
        for (const st of b.value) {
          const uuid = String(st?.stationuuid || st?.url_resolved || st?.url || '');
          if (!uuid || seenUuid.has(uuid)) continue;
          seenUuid.add(uuid);
          items.push(st);
        }
      }
    }
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=43200');
    res.status(200).json({ items: items.slice(0, limit * 2), totalFetched: items.length });
    return;
  }

  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter q', items: [] });
    return;
  }

  const queryLower = q.toLowerCase();
  const normQuery = normalizeText(q);

  try {
    const [artistSearchRes, trackSearchRes, strictSearchRes] = await Promise.all([
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`, {
        signal: AbortSignal.timeout(3500)
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&order=RANKING&limit=40`, {
        signal: AbortSignal.timeout(3500)
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=25`, {
        signal: AbortSignal.timeout(3500)
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ]);

    const artistCandidates = (artistSearchRes?.data || [])
      .filter((a) => a?.id && a?.name && !isNonOriginalTitle(a.name, queryLower))
      .map((a) => {
        const normName = normalizeText(a.name);
        let matchScore = 0;
        if (normName && normQuery && normName === normQuery) matchScore = 100_000_000;
        else if (normName && normQuery && (normName.startsWith(normQuery) || normQuery.startsWith(normName))) matchScore = 1_000_000;
        else if (normName && normQuery && normName.includes(normQuery)) matchScore = 100_000;
        return {
          id: a.id,
          name: a.name,
          fans: Number(a.nb_fan) || 0,
          normName,
          totalScore: matchScore + (Number(a.nb_fan) || 0)
        };
      })
      .filter((a) => a.totalScore >= 100_000 && a.fans >= 20)
      .sort((a, b) => b.totalScore - a.totalScore);

    let topArtist = artistCandidates[0] || null;
    let artistTopTracks = [];

    if (topArtist) {
      artistTopTracks = await fetchDeezerArtistTop(topArtist.id);

      if (artistTopTracks.length === 0 && artistCandidates[1] && artistCandidates[1].normName === normQuery) {
        topArtist = artistCandidates[1];
        artistTopTracks = await fetchDeezerArtistTop(topArtist.id);
      }
    }

    const searchPool = [
      ...(Array.isArray(trackSearchRes?.data) ? trackSearchRes.data : []),
      ...(Array.isArray(strictSearchRes?.data) ? strictSearchRes.data : [])
    ];
    const seenTrackIds = new Set();
    const dedupedSearchTracks = [];
    for (const item of searchPool) {
      if (item?.id && !seenTrackIds.has(item.id)) {
        seenTrackIds.add(item.id);
        dedupedSearchTracks.push(item);
      }
    }

    const combined = [
      ...artistTopTracks.map((t) => mapDeezerTrack(t, true)),
      ...dedupedSearchTracks.map((t) => mapDeezerTrack(t, false))
    ].filter((t) => t.title && t.artist && t.duration >= 40 && t.duration <= 2400 && !isNonOriginalTitle(t.title, queryLower));

    res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    res.status(200).json({
      matchedArtist: topArtist?.name || '',
      artistFans: topArtist?.fans || 0,
      items: combined
    });
  } catch {
    res.status(500).json({ matchedArtist: '', artistFans: 0, items: [] });
  }
}

