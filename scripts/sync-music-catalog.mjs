import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DAY_LOCK_MS = 23 * 60 * 60 * 1000;

const BLOCKED_MODIFIER_REGEX =
  /\b(karaoke|8d\s+audio|nightcore|slowed(?:\s*\+\s*|\s+)reverb|sped\s+up|ringtone|parody|backing\s+track|music\s+box|lullaby|8-bit|10\s+hours?|1\s+hour|extended\s+mix)\b/i;
const PAREN_COVER_OR_REMIX_REGEX =
  /(?:[([]\s*(?:cover|remix|karaoke|instrumental|tribute|slowed|reverb|sped\s*up|nightcore|8d|loop)\b|\b(?:acoustic|piano|guitar|vocal|drum)\s+cover\b|\bcover\s+(?:by|version)\b|\btribute\s+to\b)/i;

function isNonOriginalTitle(title) {
  const lower = String(title || '').toLowerCase();
  return BLOCKED_MODIFIER_REGEX.test(lower) || PAREN_COVER_OR_REMIX_REGEX.test(lower);
}

function mapDeezerTrack(t) {
  const coverUrl =
    t?.album?.cover_big ||
    t?.album?.cover_xl ||
    (t?.md5_image ? `https://cdn-images.dzcdn.net/images/cover/${t.md5_image}/500x500-000000-80-0-0.jpg` : '');

  return {
    id: `dz-${t.id}`,
    title: String(t.title || t.title_short || ''),
    artist: String(t.artist?.name || ''),
    album: String(t.album?.title || 'Single'),
    duration: Number(t.duration) || 210,
    coverUrl: String(coverUrl || ''),
    deezerRank: Number(t.rank) || 0,
    fromArtistTop: false
  };
}

async function fetchAppleRssWithDurations(country, limit) {
  const rssUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`;
  const res = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const json = await res.json();
  const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];

  const parsed = entries
    .map((e, idx) => {
      const id = e?.id?.attributes?.['im:id'] || `${country}-${idx}`;
      const images = Array.isArray(e?.['im:image']) ? e['im:image'] : [];
      const rawCover = images[images.length - 1]?.label || '';
      return {
        itunesId: String(id),
        title: String(e?.['im:name']?.label || ''),
        artist: String(e?.['im:artist']?.label || ''),
        album: String(e?.['im:collection']?.['im:name']?.label || 'Single'),
        genre: String(e?.category?.attributes?.label || 'Pop'),
        coverUrl: String(rawCover || ''),
        chartPos: idx + 1
      };
    })
    .filter((x) => x.title && x.artist && !isNonOriginalTitle(x.title));

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
        { signal: AbortSignal.timeout(5000) }
      );
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        for (const item of lookupData?.results || []) {
          if (item?.trackId) {
            if (item.trackTimeMillis) {
              durationMap.set(String(item.trackId), Math.round(item.trackTimeMillis / 1000));
            }
            if (item.artworkUrl100) {
              artworkMap.set(
                String(item.trackId),
                String(item.artworkUrl100).replace('100x100bb', '600x600bb')
              );
            }
          }
        }
      }
    } catch {
      // Safe fallback to RSS artwork and default duration
    }
  }

  return parsed.map((p) => ({
    id: `it-chart-${country}-${p.itunesId}`,
    title: p.title,
    artist: p.artist,
    album: p.album,
    genre: p.genre,
    duration: durationMap.get(p.itunesId) || 210,
    coverUrl:
      artworkMap.get(p.itunesId) ||
      p.coverUrl.replace(/\d+x\d+bb/, '600x600bb'),
    deezerRank: Math.max(0, 1_000_000 - p.chartPos * 20_000),
    fromArtistTop: false
  }));
}

const BLOCKED_EXPLICIT_RE = /\b(cunt|fuck|shit|shat|bitch|whore|porn|xxx)\b/i;
const SEASONAL_RE = /\b(christmas|xmas|natal|holiday)\b/i;

async function fetchChartAlbums() {
  try {
    const res = await fetch('https://api.deezer.com/chart/0/albums?limit=24', {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    return list
      .filter(
        (a) =>
          a?.id &&
          a?.title &&
          a?.artist?.name &&
          a.explicit_lyrics !== true &&
          !BLOCKED_EXPLICIT_RE.test(`${a.title} ${a.artist.name}`)
      )
      .slice(0, 12)
      .map((a) => ({
        id: String(a.id),
        title: String(a.title),
        artist: String(a.artist.name),
        coverUrl: String(a.cover_xl || a.cover_big || a.cover_medium || ''),
        nbTracks: Number(a.nb_tracks) || 10,
        genre: String(a.record_type || 'Album'),
        recordType: String(a.record_type || 'album')
      }));
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetArg = args.find((a) => !a.startsWith('--')) || 'daily-charts.json';
  const outPath = path.resolve(targetArg);

  if (!force && existsSync(outPath)) {
    try {
      const existing = JSON.parse(readFileSync(outPath, 'utf8'));
      const lastSyncMs = Date.parse(existing?.generatedAt || '');
      if (Number.isFinite(lastSyncMs)) {
        const elapsedMs = Date.now() - lastSyncMs;
        if (elapsedMs < DAY_LOCK_MS) {
          const nextEligibleIso = new Date(lastSyncMs + 24 * 60 * 60 * 1000).toISOString();
          console.log(
            `Skip sync: updated ${(elapsedMs / 3600000).toFixed(2)}h ago (< 23h guard). Next sync after ${nextEligibleIso}.`
          );
          return;
        }
      }
    } catch {
      // Proceed cleanly if prior cache file was unreadable
    }
  }

  const fetchChartPlaylists = async () => {
    try {
      const [chartRes, topRes] = await Promise.all([
        fetch('https://api.deezer.com/chart/0/playlists?limit=20', { signal: AbortSignal.timeout(5500) }),
        fetch('https://api.deezer.com/search/playlist?q=Top%20Hits&limit=10', { signal: AbortSignal.timeout(5500) })
      ]);
      const chartJson = chartRes.ok ? await chartRes.json() : null;
      const topJson = topRes.ok ? await topRes.json() : null;
      const combined = [
        ...(Array.isArray(topJson?.data) ? topJson.data : []),
        ...(Array.isArray(chartJson?.data) ? chartJson.data : [])
      ];
      const seen = new Set();
      const mapped = [];
      for (const p of combined) {
        if (
          !p?.id ||
          !p?.title ||
          (Number(p.nb_tracks) || 0) < 5 ||
          BLOCKED_EXPLICIT_RE.test(String(p.title))
        ) {
          continue;
        }
        const id = `dz-pl-${p.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        mapped.push({
          id,
          title: String(p.title || '').trim(),
          creator: String(p.user?.name || 'Editorial Charts').trim(),
          coverUrl: String(p.picture_xl || p.picture_big || p.picture_medium || ''),
          nbTracks: Number(p.nb_tracks) || 0,
          description: p.creation_date ? `Updated ${String(p.creation_date).slice(0, 10)}` : ''
        });
      }
      mapped.sort((a, b) => Number(SEASONAL_RE.test(a.title)) - Number(SEASONAL_RE.test(b.title)));
      return mapped.slice(0, 16);
    } catch {
      return [];
    }
  };

  const [dzGlobal, usRss, idRss, featuredAlbums, featuredPlaylists] = await Promise.all([
    fetch('https://api.deezer.com/chart/0/tracks?limit=35', { signal: AbortSignal.timeout(5500) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetchAppleRssWithDurations('us', 25).catch(() => []),
    fetchAppleRssWithDurations('id', 25).catch(() => []),
    fetchChartAlbums(),
    fetchChartPlaylists()
  ]);

  const dzItems = Array.isArray(dzGlobal?.data)
    ? dzGlobal.data
        .map((t) => mapDeezerTrack(t))
        .filter(
          (t) => t.title && t.artist && t.duration >= 60 && t.duration <= 1800 && !isNonOriginalTitle(t.title)
        )
    : [];

  const globalList = dzItems.length > 0 ? dzItems : usRss;
  if (globalList.length === 0 && idRss.length === 0) {
    throw new Error('Upstream chart feeds returned zero tracks; keeping existing catalog intact.');
  }

  const nowMs = Date.now();
  const payload = {
    schemaVersion: 2,
    source: 'github-actions-cicd',
    generatedAt: new Date(nowMs).toISOString(),
    nextEligibleSyncAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
    global: globalList,
    us: usRss,
    indonesia: idRss,
    featuredAlbums,
    featuredPlaylists
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload), 'utf8');
  console.log(
    `Synced catalog -> ${outPath} (global=${globalList.length}, us=${usRss.length}, id=${idRss.length}, albums=${featuredAlbums.length}, playlists=${featuredPlaylists.length})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

