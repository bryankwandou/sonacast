import type { TabType } from '../types';

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
  const direct = ROUTE_ALIAS_TO_TAB[cleanPath];
  if (direct && direct !== 'landing') {
    return direct;
  }

  const params = new URLSearchParams(search || '');
  if (params.get('blend')?.trim()) return 'blend';
  if (params.get('track')?.trim()) return 'discover';
  return direct || 'landing';
}

export function syncUrlForTab(tab: TabType, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined' || tab === 'pitch') return;
  const targetPath = getRoutePathForTab(tab);
  const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  let nextSearch = '';
  if (tab === 'blend' && params.get('blend')) {
    nextSearch = `?blend=${encodeURIComponent(params.get('blend') || '')}`;
  } else if ((tab === 'discover' || tab === 'music') && mode === 'replace' && params.get('track')) {
    nextSearch = `?track=${encodeURIComponent(params.get('track') || '')}`;
  }

  const nextFullUrl = `${targetPath}${nextSearch}`;
  const currentFullUrl = `${currentPath}${window.location.search}`;
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

