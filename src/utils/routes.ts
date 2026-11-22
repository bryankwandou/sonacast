import type { TabType } from '../types';
import { parseSharedTrackFromUrl } from './shareTrack';

export const TAB_ROUTE_MAP: Record<TabType, string> = {
  landing: '/',
  music: '/music',
  discover: '/home',
  vibe: '/vibe',
  search: '/search',
  favorites: '/favorites',
  blend: '/blend',
  radio: '/radio',
  podcasts: '/podcasts',
  visualizer: '/visualizer',
  proofOfStream: '/proof-of-stream',
  pitch: '/pitch'
};

const ROUTE_ALIAS_TO_TAB: Record<string, TabType> = {
  '/': 'landing',
  '/landing': 'landing',
  '/home': 'discover',
  '/discover': 'discover',
  '/music': 'music',
  '/musik': 'music',
  '/track': 'music',
  '/song': 'music',
  '/explore': 'music',
  '/albums': 'music',
  '/vibe': 'vibe',
  '/search': 'search',
  '/library': 'favorites',
  '/favorites': 'favorites',
  '/collection': 'favorites',
  '/blend': 'blend',
  '/radio': 'radio',
  '/podcasts': 'podcasts',
  '/podcast': 'podcasts',
  '/visualizer': 'visualizer',
  '/orbwave': 'visualizer',
  '/proof-of-stream': 'proofOfStream',
  '/proof': 'proofOfStream'
};

const TAB_PAGE_TITLES: Record<TabType, string> = {
  landing: 'Sonacast — Music Streaming & Live Radio',
  music: 'Music · Popular Studio Albums, Daily Playlists & Charts — Sonacast',
  discover: 'Home — Sonacast',
  vibe: 'Vibe Feed — Sonacast',
  search: 'Search Catalog — Sonacast',
  favorites: 'Your Library & Favorites — Sonacast',
  blend: 'Blend Music — Sonacast',
  radio: 'Live Radio — Sonacast',
  podcasts: 'Podcasts — Sonacast',
  visualizer: 'Orbwave Studio — Sonacast',
  proofOfStream: 'Proof of Stream — Sonacast',
  pitch: 'Platform Overview — Sonacast'
};

export function getRoutePathForTab(tab: TabType): string {
  return TAB_ROUTE_MAP[tab] || '/';
}

export function getPageTitleForTab(tab: TabType): string {
  return TAB_PAGE_TITLES[tab] || TAB_PAGE_TITLES.landing;
}

export function parseTabFromUrl(pathname: string, search: string): TabType {
  const cleanPath = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (/^\/(?:track|song)(?:\/|$)/i.test(cleanPath) || parseSharedTrackFromUrl(pathname, search)) {
    return 'music';
  }

  const direct = ROUTE_ALIAS_TO_TAB[cleanPath];
  if (direct && direct !== 'landing') {
    return direct;
  }

  const params = new URLSearchParams(search || '');
  if (params.get('blend')?.trim()) return 'blend';
  if (params.get('album')?.trim()) return 'favorites';
  return direct || 'landing';
}

export function syncUrlForTab(tab: TabType, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined' || tab === 'pitch') return;
  const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const rawSearch = window.location.search || '';
  const params = new URLSearchParams(rawSearch);

  // Preserve shared track deep-links intact on initial mount / replace so query parameters
  // (id, title, artist, album, dur, yt, cover, legacy track) are never stripped before hydration.
  if (mode === 'replace' && parseSharedTrackFromUrl(window.location.pathname, rawSearch)) {
    const sharedPath = /^\/(?:track|song)(?:\/|$)/i.test(currentPath) ? window.location.pathname : '/track';
    const nextFullUrl = `${sharedPath}${rawSearch}`;
    const currentFullUrl = `${window.location.pathname}${rawSearch}`;
    if (nextFullUrl !== currentFullUrl) {
      try {
        window.history.replaceState({ tab }, '', nextFullUrl);
      } catch {
        // Ignore history API restrictions in sandboxed origins
      }
    }
    return;
  }

  const targetPath = getRoutePathForTab(tab);
  let nextSearch = '';
  if (tab === 'blend' && params.get('blend')) {
    nextSearch = `?blend=${encodeURIComponent(params.get('blend') || '')}`;
  } else if (tab === 'favorites' && mode === 'replace' && params.get('album')) {
    nextSearch = `?album=${encodeURIComponent(params.get('album') || '')}`;
  }

  const nextFullUrl = `${targetPath}${nextSearch}`;
  const currentFullUrl = `${currentPath}${rawSearch}`;
  if (nextFullUrl !== currentFullUrl) {
    try {
      if (mode === 'replace') {
        window.history.replaceState({ tab }, '', nextFullUrl);
      } else {
        window.history.pushState({ tab }, '', nextFullUrl);
      }
    } catch {
      // Ignore history API restrictions in sandboxed origins
    }
  }
  document.title = getPageTitleForTab(tab);
}

