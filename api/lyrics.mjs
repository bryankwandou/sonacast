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

  let offsetSeconds = 0;
  const offsetMatch = lrcText.match(/\[offset\s*:\s*([+-]?\d+)\]/i);
  if (offsetMatch) {
    const offsetMs = parseInt(offsetMatch[1], 10);
    if (Number.isFinite(offsetMs)) {
      offsetSeconds = -offsetMs / 1000;
    }
  }

  const isOriginalCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(lrcText);
  const shouldUseTranslation =
    Boolean(translationText) &&
    typeof translationText === 'string' &&
    (isOriginalCjk || !/[\u4e00-\u9fff]/.test(translationText));

  const transByBucket = new Map();
  if (shouldUseTranslation) {
    for (const rawLine of translationText.split(/\r?\n/)) {
      const tags = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const body = rawLine.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
      if (!body || tags.length === 0 || CREDIT_LINE_RE.test(body)) continue;
      for (const m of tags) {
        const secs = Math.max(
          0,
          parseInt(m[1], 10) * 60 +
          parseInt(m[2], 10) +
          (m[3] ? parseFloat(`0.${m[3]}`) : 0) +
          offsetSeconds
        );
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
      const rawTime = mins * 60 + secs + ms + offsetSeconds;
      const time = Math.max(0, Math.round(rawTime * 100) / 100);
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
  const parsedSynced = cand.syncedLyrics ? parseLrcText(cand.syncedLyrics) : [];
  const candDur = Number(cand.duration) || 0;

  if (parsedSynced.length >= 5) {
    score += 38;
    const firstTime = parsedSynced[0]?.time ?? 0;
    const lastTime = parsedSynced[parsedSynced.length - 1]?.time ?? 0;
    const refDur = candDur >= 60 ? candDur : expectedDuration >= 60 ? expectedDuration : 0;
    const spanRatio = refDur >= 120 && lastTime > 0 ? lastTime / refDur : 1;
    const avgSecPerLine = (lastTime - firstTime) / Math.max(1, parsedSynced.length - 1);
    if (refDur >= 140 && lastTime > 0 && spanRatio < 0.68) {
      // Reject truncated / sped-up LRC uploads that end way before track ends
      score -= 165;
    } else if (refDur >= 120 && spanRatio < 0.74 && firstTime < 1.5) {
      score -= 140;
    } else if (parsedSynced.length >= 25 && avgSecPerLine < 0.95) {
      score -= 130;
    } else if (refDur >= 120 && lastTime >= refDur * 0.8) {
      score += 10;
    }
    if (firstTime >= 2.5) {
      score += 4;
    }
  } else if (cand.plainLyrics && cand.plainLyrics.trim().length > 40) {
    score += 10;
  } else {
    return -100;
  }

  if (expectedDuration >= 40 && candDur >= 30) {
    const diff = Math.abs(candDur - expectedDuration);
    if (diff <= 2) score += 65;
    else if (diff <= 4) score += 52;
    else if (diff <= 8) score += 32;
    else if (diff <= 14) score += 12;
    else if (diff <= 25) score -= 40;
    else score -= 90;
  }
  return score;
}

const LRCLIB_HEADERS = {
  'User-Agent': 'Sonacast/1.0 (+https://sonacast-ten.vercel.app)',
  Accept: 'application/json'
};

async function fetchFromLrclib(cleanTitle, rawTitle, cleanArtist, album, duration) {
  const candidates = [];

  const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}${album ? `&album_name=${encodeURIComponent(album)}` : ''}${duration >= 40 ? `&duration=${Math.round(duration)}` : ''}`;
  const searchPairUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
  const searchQueryUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;

  const [exactRes, pairRes, qRes] = await Promise.all([
    fetch(getUrl, { headers: LRCLIB_HEADERS, signal: AbortSignal.timeout(6000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(searchPairUrl, { headers: LRCLIB_HEADERS, signal: AbortSignal.timeout(6200) }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    rawTitle !== cleanTitle
      ? fetch(searchQueryUrl, { headers: LRCLIB_HEADERS, signal: AbortSignal.timeout(6200) }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
      : Promise.resolve([])
  ]);

  if (Array.isArray(pairRes)) candidates.push(...pairRes);
  if (Array.isArray(qRes)) candidates.push(...qRes);
  if (exactRes && (exactRes.syncedLyrics || exactRes.plainLyrics)) {
    candidates.push(exactRes);
  }

  if (!Array.isArray(pairRes) || pairRes.length === 0) {
    const fallbackRows = await fetch(searchQueryUrl, { headers: LRCLIB_HEADERS, signal: AbortSignal.timeout(5500) })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    if (Array.isArray(fallbackRows)) candidates.push(...fallbackRows);
  }

  let bestSynced = null;
  let bestSyncedScore = -Infinity;
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

  if (bestSynced && bestSyncedScore > 45) {
    const lines = parseLrcText(bestSynced.syncedLyrics);
    if (lines.length >= 4) {
      return {
        found: true,
        synced: true,
        source: 'lrclib',
        matchedDuration: Number(bestSynced.duration) || duration,
        lyrics: lines
      };
    }
  }
  if (bestPlain) {
    const plainDur = Number(bestPlain.duration) || duration;
    const lines = buildTimedPlainLyrics(bestPlain.plainLyrics, plainDur);
    if (lines.length >= 4) {
      return {
        found: true,
        synced: false,
        source: 'lrclib-plain',
        matchedDuration: plainDur,
        lyrics: lines
      };
    }
  }
  return null;
}

async function fetchFromNetease(cleanTitle, cleanArtist, duration) {
  try {
    const searchRes = await fetch(
      `https://music.163.com/api/search/get?s=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}&type=1&limit=6`,
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
        const songDur = s?.duration ? Math.round(Number(s.duration) / 1000) : 0;
        let durScore = 0;
        if (duration >= 40 && songDur >= 30) {
          const diff = Math.abs(songDur - duration);
          if (diff <= 4) durScore = 35;
          else if (diff <= 10) durScore = 18;
          else if (diff > 20) durScore = -40;
        }
        return {
          id: s?.id,
          dur: songDur,
          tOverlap,
          aOverlap,
          score: tOverlap * 55 + aOverlap * 45 + durScore
        };
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
          return {
            found: true,
            synced: true,
            source: 'netease',
            matchedDuration: match.dur || duration,
            lyrics: parsed
          };
        }
      } else if (rawLrc && rawLrc.trim().length > 40) {
        const lines = buildTimedPlainLyrics(rawLrc, match.dur || duration);
        if (lines.length >= 4) {
          return {
            found: true,
            synced: false,
            source: 'netease-plain',
            matchedDuration: match.dur || duration,
            lyrics: lines
          };
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

    const lrclibDiff =
      lrclibRes?.synced && Number(lrclibRes.matchedDuration) > 0 && duration > 0
        ? Math.abs(Number(lrclibRes.matchedDuration) - duration)
        : 999;
    const neteaseDiff =
      neteaseRes?.synced && Number(neteaseRes.matchedDuration) > 0 && duration > 0
        ? Math.abs(Number(neteaseRes.matchedDuration) - duration)
        : 999;

    const best =
      (lrclibRes?.synced && neteaseRes?.synced && lrclibDiff > 15 && neteaseDiff <= 5
        ? neteaseRes
        : null) ||
      (lrclibRes?.synced ? lrclibRes : null) ||
      (neteaseRes?.synced ? neteaseRes : null) ||
      lrclibRes ||
      ovhRes ||
      neteaseRes;

    if (best && Array.isArray(best.lyrics) && best.lyrics.length > 0) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json(best);
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ found: false, synced: false, source: 'none', lyrics: [] });
  } catch {
    res.status(200).json({ found: false, synced: false, source: 'none', lyrics: [] });
  }
}
