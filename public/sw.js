const CACHE_NAME = 'sonacast-shell-v5';
const OFFLINE_AUDIO_CACHE = 'sonacast-offline-audio-v1';

async function serveAudioFromCache(req) {
  const cache = await caches.open(OFFLINE_AUDIO_CACHE);
  const cached = await cache.match(req, { ignoreSearch: false });
  if (!cached) return null;

  const rangeHeader = req.headers.get('range');
  if (!rangeHeader) return cached;

  const buffer = await cached.arrayBuffer();
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!match) return cached;

  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), buffer.byteLength - 1) : buffer.byteLength - 1;
  if (start >= buffer.byteLength || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${buffer.byteLength}` }
    });
  }

  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
      'Content-Length': String(slice.byteLength),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['/manifest.webmanifest', '/favicon.svg']))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== OFFLINE_AUDIO_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/downloads/')
  ) {
    return;
  }

  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(
      serveAudioFromCache(req)
        .then((cachedRes) => cachedRes || fetch(req))
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic' && url.pathname.startsWith('/assets/')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

