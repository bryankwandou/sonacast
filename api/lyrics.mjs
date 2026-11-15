const HYPHEN_EDITION_RE =
  /\s+[-–—]\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|live(?:\s+.*)?|acoustic(?:\s+.*)?|deluxe(?:\s+.*)?|radio\s+edit|single(?:\s+version)?|album\s+version|explicit|clean|mono|stereo|mix|version|edition|bonus\s+track|soundtrack|from\s+.*|stripped|unplugged|demo).*$/i;
const BRACKET_MODIFIER_RE =
  /\s*[(\[]\s*(?:feat\.?|ft\.?|featuring|with|remaster(?:ed)?|\d{4}\s+remaster|live|acoustic|deluxe|radio\s+edit|single|album|explicit|clean|version|edition|bonus|official\s+.*|lyric\s+.*|audio|video|from\s+.*).*?[)\]]/gi;
const FEAT_SUFFIX_RE = /\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i;

function normalizeCompare(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function cleanTitleForLyrics(rawTitle) {
  let s = String(rawTitle || '').trim();
  s = s.replace(BRACKET_MODIFIER_RE, ' ');
  s = s.replace(HYPHEN_EDITION_RE, '');
  s = s.replace(FEAT_SUFFIX_RE, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s || String(rawTitle || '').trim();
}

export function cleanArtistForLyrics(rawArtist) {
  const s = String(rawArtist || '').trim();
  const lead = s.split(/,|&|\b(?:feat\.?|ft\.?|featuring|with)\b|\s+[x×/]\s+/i)[0]?.trim();
  return lead || s;
}

const CREDIT_LINE_RE =
  /^(?:[\s[\]()*]*)(?:作词|作曲|编曲|制作人|混音|母带|监制|吉他|贝斯|鼓|录音|合声|和声|词|曲|Written by|Composed by|Produced by|Lyrics by|Arranged by)\s*[:：]/i;

export function parseLrcText(lrcText, translationText = '') {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const transByBucket = new Map();
  if (translationText && typeof translationText === 'string') {
    for (const rawLine of translationText.split(/\r?\n/)) {
      const tags = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const body = rawLine.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
      if (!body || tags.length === 0 || CREDIT_LINE_RE.test(body)) continue;
      for (const m of tags) {
        const secs =
          parseInt(m[1], 10) * 60 +
          parseInt(m[2], 10) +
          (m[3] ? parseFloat(`0.${m[3]}`) : 0);
        transByBucket.set(Math.round(secs * 2), body);
      }
    }
  }

  const parsed = [];
  for (const rawLine of lrcText.split(/\r?\n/)) {
    const tags = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (tags.length === 0) continue;
    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();
    if (!text || CREDIT_LINE_RE.test(text)) continue;
    for (const m of tags) {
      const mins = parseInt(m[1], 10);
      const secs = parseInt(m[2], 10);
      const ms = m[3] ? parseFloat(`0.${m[3]}`) : 0;
      const time = Math.round((mins * 60 + secs + ms) * 100) / 100;
      const translation = transByBucket.get(Math.round(time * 2));
      parsed.push(translation && translation !== text ? { time, text, translation } : { time, text });
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

export function buildTimedPlainLyrics(plainText, durationSeconds = 210) {
  if (!plainText || typeof plainText !== 'string') return [];
  const lines = plainText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[(?:verse|chorus|bridge|intro|outro|pre-chorus|hook|refrain|instrumental).*\]$/i.test(l));

  if (lines.length === 0) return [];
  const totalDur = Number.isFinite(durationSeconds) && durationSeconds >= 30 ? durationSeconds : 210;
  const startOffset = totalDur >= 90 ? Math.min(12, Math.round(totalDur * 0.055)) : 2;
  const endMargin = totalDur >= 60 ? Math.min(14, Math.round(totalDur * 0.065)) : 2;
  const activeSpan = Math.max(15, totalDur - startOffset - endMargin);
  const step = activeSpan / Math.max(1, lines.length);

  return lines.map((text, idx) => ({
    time: Math.round((startOffset + idx * step) * 10) / 10,
    text
  }));
}

function tokenOverlapScore(candStr, targetStr) {
  const candNorm = normalizeCompare(candStr);
  const targetNorm = normalizeCompare(targetStr);
  if (!candNorm || !targetNorm) return 0;
  if (candNorm === targetNorm) return 1;
  if (candNorm.includes(targetNorm) || targetNorm.includes(candNorm)) return 0.85;
  const candWords = new Set(candNorm.split(' ').filter((w) => w.length >= 2));
  const targetWords = targetNorm.split(' ').filter((w) => w.length >= 2);
  if (targetWords.length === 0) return 0;
  let hits = 0;
  for (const w of targetWords) {
    if (candWords.has(w)) hits += 1;
  }
  return hits / targetWords.length;
}

function scoreLrcCandidate(cand, cleanTitle, cleanArtist, expectedDuration) {
  if (!cand) return -100;
  const titleScore = tokenOverlapScore(cand.trackName || cand.name || '', cleanTitle);
  const artistScore = tokenOverlapScore(cand.artistName || '', cleanArtist);
  if (titleScore < 0.45 || artistScore < 0.35) return -50;

  let score = titleScore * 50 + artistScore * 40;
  if (cand.syncedLyrics && parseLrcText(cand.syncedLyrics).length >= 5) {
    score += 35;
  } else if (cand.plainLyrics && cand.plainLyrics.trim().length > 40) {
    score += 10;
  } else {
    return -100;
  }

  const candDur = Number(cand.duration) || 0;
  if (expectedDuration >= 40 && candDur >= 40) {
    const diff = Math.abs(candDur - expectedDuration);
    if (diff <= 5) score += 20;
    else if (diff <= 15) score += 10;
    else if (diff > 75) score -= 25;
  }
  return score;
}

async function fetchFromLrclib(cleanTitle, rawTitle, cleanArtist, album, duration) {
  const candidates = [];

  const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}${album ? `&album_name=${encodeURIComponent(album)}` : ''}${duration >= 40 ? `&duration=${Math.round(duration)}` : ''}`;
  const searchPairUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
  const searchQueryUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;

  const [exactRes, pairRes, qRes] = await Promise.all([
    fetch(getUrl, { signal: AbortSignal.timeout(4200) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(searchPairUrl, { signal: AbortSignal.timeout(4200) }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    rawTitle !== cleanTitle
      ? fetch(searchQueryUrl, { signal: AbortSignal.timeout(4200) }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
      : Promise.resolve([])
  ]);

  if (exactRes && (exactRes.syncedLyrics || exactRes.plainLyrics)) {
    candidates.push(exactRes);
  }
  if (Array.isArray(pairRes)) candidates.push(...pairRes);
  if (Array.isArray(qRes)) candidates.push(...qRes);

  if (candidates.length === 0) {
    const fallbackRows = await fetch(searchQueryUrl, { signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    if (Array.isArray(fallbackRows)) candidates.push(...fallbackRows);
  }

  let bestSynced = null;
  let bestSyncedScore = 30;
  let bestPlain = null;
  let bestPlainScore = 25;

  for (const c of candidates) {
    const sc = scoreLrcCandidate(c, cleanTitle, cleanArtist, duration);
    if (c?.syncedLyrics && parseLrcText(c.syncedLyrics).length >= 5) {
      if (sc > bestSyncedScore) {
        bestSyncedScore = sc;
        bestSynced = c;
      }
    } else if (c?.plainLyrics && c.plainLyrics.trim().length > 40) {
      if (sc > bestPlainScore) {
        bestPlainScore = sc;
        bestPlain = c;
      }
    }
  }

  if (bestSynced) {
    const lines = parseLrcText(bestSynced.syncedLyrics);
    if (lines.length >= 4) {
      return { found: true, synced: true, source: 'lrclib', lyrics: lines };
    }
  }
  if (bestPlain) {
    const lines = buildTimedPlainLyrics(bestPlain.plainLyrics, Number(bestPlain.duration) || duration);
    if (lines.length >= 4) {
      return { found: true, synced: false, source: 'lrclib-plain', lyrics: lines };
    }
  }
  return null;
}

async function fetchFromNetease(cleanTitle, cleanArtist, duration) {
  try {
    const searchRes = await fetch(
      `https://music.163.com/api/search/get?s=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}&type=1&limit=5`,
      {
        headers: { Referer: 'https://music.163.com' },
        signal: AbortSignal.timeout(4000)
      }
    );
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const songs = Array.isArray(searchJson?.result?.songs) ? searchJson.result.songs : [];

    const ranked = songs
      .map((s) => {
        const artistJoined = Array.isArray(s?.artists) ? s.artists.map((a) => a.name).join(' ') : '';
        const tOverlap = tokenOverlapScore(s?.name || '', cleanTitle);
        const aOverlap = tokenOverlapScore(artistJoined, cleanArtist);
        return { id: s?.id, tOverlap, aOverlap, score: tOverlap * 55 + aOverlap * 45 };
      })
      .filter((x) => x.id && x.tOverlap >= 0.55 && x.aOverlap >= 0.45)
      .sort((a, b) => b.score - a.score);

    for (const match of ranked.slice(0, 2)) {
      const lrcRes = await fetch(
        `https://music.163.com/api/song/lyric?id=${match.id}&lv=1&kv=1&tv=-1`,
        {
          headers: { Referer: 'https://music.163.com' },
          signal: AbortSignal.timeout(4000)
        }
      );
      if (!lrcRes.ok) continue;
      const lrcJson = await lrcRes.json();
      const rawLrc = lrcJson?.lrc?.lyric || '';
      const rawTrans = lrcJson?.tlyric?.lyric || '';
      if (rawLrc && /\[\d{1,3}:\d{2}/.test(rawLrc)) {
        const parsed = parseLrcText(rawLrc, rawTrans);
        if (parsed.length >= 5) {
          return { found: true, synced: true, source: 'netease', lyrics: parsed };
        }
      } else if (rawLrc && rawLrc.trim().length > 40) {
        const lines = buildTimedPlainLyrics(rawLrc, duration);
        if (lines.length >= 4) {
          return { found: true, synced: false, source: 'netease-plain', lyrics: lines };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromLyricsOvh(cleanTitle, cleanArtist, duration) {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`,
      { signal: AbortSignal.timeout(4200) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lyrics === 'string' && data.lyrics.trim().length > 40) {
      const lines = buildTimedPlainLyrics(data.lyrics, duration);
      if (lines.length >= 4) {
        return { found: true, synced: false, source: 'lyrics.ovh', lyrics: lines };
      }
    }
    return null;
  } catch {
    return null;
  }
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

  const rawTitle = typeof req.query?.title === 'string' ? req.query.title.trim() : '';
  const rawArtist = typeof req.query?.artist === 'string' ? req.query.artist.trim() : '';
  const album = typeof req.query?.album === 'string' ? req.query.album.trim() : '';
  const duration = Number(req.query?.duration) || 210;

  if (!rawTitle || !rawArtist) {
    res.status(400).json({ found: false, synced: false, source: 'none', lyrics: [] });
    return;
  }

  const cleanTitle = cleanTitleForLyrics(rawTitle);
  const cleanArtist = cleanArtistForLyrics(rawArtist);

  try {
    const [lrclibRes, neteaseRes, ovhRes] = await Promise.all([
      fetchFromLrclib(cleanTitle, rawTitle, cleanArtist, album, duration),
      fetchFromNetease(cleanTitle, cleanArtist, duration),
      fetchFromLyricsOvh(cleanTitle, cleanArtist, duration)
    ]);

    const best =
      (lrclibRes?.synced ? lrclibRes : null) ||
      (neteaseRes?.synced ? neteaseRes : null) ||
      lrclibRes ||
      ovhRes ||
      neteaseRes;

    if (best && Array.isArray(best.lyrics) && best.lyrics.length > 0) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json(best);
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({ found: false, synced: false, source: 'none', lyrics: [] });
  } catch {
    res.status(200).json({ found: false, synced: false, source: 'none', lyrics: [] });
  }
}
