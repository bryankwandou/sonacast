const BLOCKED_MODIFIER_REGEX =
  /\b(karaoke|8d\s+audio|nightcore|slowed(?:\s*\+\s*|\s+)reverb|sped\s+up|ringtone|parody|backing\s+track|music\s+box|lullaby|8-bit|10\s+hours?|1\s+hour|extended\s+mix|snippet|30\s+sec)\b/i;
const PAREN_COVER_OR_REMIX_REGEX =
  /(?:[([]\s*(?:cover|remix|karaoke|instrumental|tribute|slowed|reverb|sped\s*up|nightcore|8d|loop)\b|\b(?:acoustic|piano|guitar|vocal|drum)\s+cover\b|\bcover\s+(?:by|version)\b|\btribute\s+to\b)/i;

function isNonOriginalTitle(title, queryLower) {
  const lower = (title || '').toLowerCase();
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

async function queryPipedMusicSongs(q, queryLower) {
  try {
    const pipedUrl = `https://api.piped.private.coffee/search?q=${encodeURIComponent(q)}&filter=music_songs`;
    const pipedRes = await fetch(pipedUrl, { signal: AbortSignal.timeout(5000) });
    if (!pipedRes.ok) return [];
    const pipedData = await pipedRes.json();
    const rawItems = Array.isArray(pipedData?.items) ? pipedData.items : [];
    return rawItems
      .map((item) => {
        const id = (item.url || '').split('v=')[1]?.split('&')[0] || '';
        return {
          videoId: id,
          title: item.title || '',
          author: item.uploaderName || '',
          duration: Number(item.duration) || 0,
          thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
        };
      })
      .filter((x) => x.videoId && x.duration >= 40 && x.duration <= 2400 && !isNonOriginalTitle(x.title, queryLower));
  } catch {
    return [];
  }
}

function parseLengthSeconds(text) {
  if (!text) return 0;
  const parts = String(text).split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const mode = typeof req.query?.mode === 'string' ? req.query.mode.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter q', items: [] });
    return;
  }

  const queryLower = q.toLowerCase();

  const sendCached = (payload, maxAge = 86400, swr = 604800) => {
    res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`);
    res.status(200).json(payload);
  };

  if (mode !== 'yt') {
    const cleaned = await queryPipedMusicSongs(q, queryLower);
    if (cleaned.length >= 4) {
      sendCached({ source: 'piped', items: cleaned });
      return;
    }
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} official audio`)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(5500)
    });

    if (!ytRes.ok) {
      const pipedFallback = await queryPipedMusicSongs(q, queryLower);
      sendCached({ source: 'piped-fallback', items: pipedFallback }, pipedFallback.length > 0 ? 86400 : 1800);
      return;
    }

    const html = await ytRes.text();
    const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
    if (!match) {
      const fallbackIds = [...new Set([...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]))].slice(0, 10);
      if (fallbackIds.length >= 2) {
        sendCached({
          source: 'yt-ids',
          items: fallbackIds.map((videoId) => ({
            videoId,
            title: q,
            author: '',
            duration: 210,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          }))
        });
        return;
      }
      const pipedFallback = await queryPipedMusicSongs(q, queryLower);
      sendCached({ source: 'piped-fallback', items: pipedFallback }, pipedFallback.length > 0 ? 86400 : 1800);
      return;
    }

    const data = JSON.parse(match[1]);
    const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const items = [];

    for (const sec of sections) {
      const contents = sec?.itemSectionRenderer?.contents || [];
      for (const entry of contents) {
        const vr = entry?.videoRenderer;
        if (!vr || !vr.videoId) continue;
        const title = vr.title?.runs?.map((r) => r.text).join('') || '';
        const author = vr.ownerText?.runs?.map((r) => r.text).join('') || '';
        const durationText = vr.lengthText?.simpleText || '';
        const duration = parseLengthSeconds(durationText);
        if (duration > 0 && (duration < 40 || duration > 2400)) continue;
        if (isNonOriginalTitle(title, queryLower)) continue;

        items.push({
          videoId: vr.videoId,
          title,
          author,
          duration: duration || 210,
          thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`
        });
      }
    }

    if (items.length < 2) {
      const pipedFallback = await queryPipedMusicSongs(q, queryLower);
      if (pipedFallback.length > items.length) {
        sendCached({ source: 'piped-fallback', items: pipedFallback }, pipedFallback.length > 0 ? 86400 : 1800);
        return;
      }
    }

    sendCached({ source: 'yt-html', items: items.slice(0, 20) }, items.length > 0 ? 86400 : 1800);
  } catch {
    const pipedFallback = await queryPipedMusicSongs(q, queryLower);
    sendCached({ source: 'piped-fallback', items: pipedFallback }, pipedFallback.length > 0 ? 86400 : 1800);
  }
}

