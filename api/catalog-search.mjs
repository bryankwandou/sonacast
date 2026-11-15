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

function mapDeezerTrack(t, fromArtistTop) {
  const coverUrl =
    t?.album?.cover_big ||
    t?.album?.cover_xl ||
    (t?.md5_image ? `https://cdn-images.dzcdn.net/images/cover/${t.md5_image}/500x500-000000-80-0-0.jpg` : '');

  return {
    id: `dz-${t.id}`,
    title: t.title || t.title_short || '',
    artist: t.artist?.name || '',
    album: t.album?.title || 'Single',
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
        if (!mapped.title || mapped.nbTracks < 2 || seen.has(key)) continue;
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
      const [dzGlobal, usRss, idRss, dzChartAlbums, dzChartPlaylists] = await Promise.all([
        fetch('https://api.deezer.com/chart/0/tracks?limit=35', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchAppleRssWithDurations('us', 25).catch(() => []),
        fetchAppleRssWithDurations('id', 25).catch(() => []),
        fetch('https://api.deezer.com/chart/0/albums?limit=16', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch('https://api.deezer.com/chart/0/playlists?limit=16', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const dzItems = Array.isArray(dzGlobal?.data)
        ? dzGlobal.data
            .map((t) => mapDeezerTrack(t, false))
            .filter((t) => t.title && t.artist && t.duration >= 60 && t.duration <= 1800 && !isNonOriginalTitle(t.title, ''))
        : [];

      const featuredAlbums = Array.isArray(dzChartAlbums?.data)
        ? dzChartAlbums.data
            .filter((a) => a?.id && a?.title)
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

      const featuredPlaylists = Array.isArray(dzChartPlaylists?.data)
        ? dzChartPlaylists.data
            .filter((p) => p?.id && p?.title && (Number(p.nb_tracks) || 0) >= 2)
            .map(mapDeezerPlaylist)
        : [];

      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json({
        global: dzItems.length > 0 ? dzItems : usRss,
        us: usRss,
        indonesia: idRss,
        featuredAlbums,
        featuredPlaylists
      });
      return;
    } catch {
      res.status(500).json({ global: [], us: [], indonesia: [], featuredAlbums: [], featuredPlaylists: [] });
      return;
    }
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

