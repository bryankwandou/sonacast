const BLOCKED_WORDS = [
  'karaoke',
  '8d audio',
  '8d',
  'nightcore',
  'slowed',
  'reverb',
  'sped up',
  'tribute',
  'ringtone',
  '30 sec',
  'snippet',
  'backing track',
  'instrumental',
  'parody',
  'teaser',
  'piano version',
  'acoustic version',
  'medley',
  'orchestral',
  'music box',
  'lullaby',
  '8-bit',
  '10 hours',
  '1 hour',
  'extended mix',
  'loop'
];

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isNonOriginalTitle(title, queryLower) {
  const lower = String(title || '').toLowerCase();
  for (const w of BLOCKED_WORDS) {
    if (lower.includes(w) && !queryLower.includes(w)) {
      return true;
    }
  }
  if ((lower.includes('remix') && !queryLower.includes('remix')) || (lower.includes('cover') && !queryLower.includes('cover'))) {
    return true;
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

  if (mode === 'charts') {
    try {
      const [dzGlobal, usRss, idRss] = await Promise.all([
        fetch('https://api.deezer.com/chart/0/tracks?limit=35', { signal: AbortSignal.timeout(3800) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchAppleRssWithDurations('us', 25).catch(() => []),
        fetchAppleRssWithDurations('id', 25).catch(() => [])
      ]);

      const dzItems = Array.isArray(dzGlobal?.data)
        ? dzGlobal.data
            .map((t) => mapDeezerTrack(t, false))
            .filter((t) => t.title && t.artist && t.duration >= 60 && t.duration <= 1800 && !isNonOriginalTitle(t.title, ''))
        : [];

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      res.status(200).json({
        global: dzItems.length > 0 ? dzItems : usRss,
        us: usRss,
        indonesia: idRss
      });
      return;
    } catch {
      res.status(500).json({ global: [], us: [], indonesia: [] });
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
    const [artistSearchRes, trackSearchRes] = await Promise.all([
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`, {
        signal: AbortSignal.timeout(3500)
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&order=RANKING&limit=40`, {
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
        if (normName === normQuery) matchScore = 100_000_000;
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
      .filter((a) => a.totalScore >= 100_000 && a.fans >= 500)
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

    const combined = [
      ...artistTopTracks.map((t) => mapDeezerTrack(t, true)),
      ...(Array.isArray(trackSearchRes?.data) ? trackSearchRes.data.map((t) => mapDeezerTrack(t, false)) : [])
    ].filter((t) => t.title && t.artist && t.duration >= 60 && t.duration <= 1800 && !isNonOriginalTitle(t.title, queryLower));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.status(200).json({
      matchedArtist: topArtist?.name || '',
      artistFans: topArtist?.fans || 0,
      items: combined
    });
  } catch {
    res.status(500).json({ matchedArtist: '', artistFans: 0, items: [] });
  }
}

