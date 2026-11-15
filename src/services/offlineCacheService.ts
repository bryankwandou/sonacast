export const OFFLINE_AUDIO_CACHE = 'sonacast-offline-audio-v1';

export function normalizeOfflineKey(audioUrl: string): string {
  if (typeof window === 'undefined') return audioUrl.trim();
  try {
    const parsed = new URL(audioUrl.trim(), window.location.origin);
    return parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}`
      : parsed.href;
  } catch {
    return audioUrl.trim();
  }
}

export function isCacheableAudioUrl(audioUrl?: string): boolean {
  if (!audioUrl) return false;
  const trimmed = audioUrl.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function isTrackSavedOffline(offlineKeys: Set<string>, audioUrl?: string): boolean {
  if (!audioUrl || offlineKeys.size === 0) return false;
  return offlineKeys.has(normalizeOfflineKey(audioUrl));
}

export async function listOfflineAudioUrls(): Promise<Set<string>> {
  const keys = new Set<string>();
  if (typeof window === 'undefined' || !('caches' in window)) return keys;
  try {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE);
    const requests = await cache.keys();
    for (const req of requests) {
      keys.add(normalizeOfflineKey(req.url));
    }
  } catch {
    // Ignore storage quota or insecure context failures gracefully.
  }
  return keys;
}

export async function saveTrackOffline(audioUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !isCacheableAudioUrl(audioUrl)) {
    return false;
  }
  const absoluteUrl = new URL(audioUrl.trim(), window.location.origin).href;
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) return false;
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE);
    await cache.put(absoluteUrl, response.clone());
    window.dispatchEvent(new CustomEvent('sonacast-offline-changed'));
    return true;
  } catch {
    return false;
  }
}

export async function removeTrackOffline(audioUrl: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !isCacheableAudioUrl(audioUrl)) {
    return false;
  }
  const absoluteUrl = new URL(audioUrl.trim(), window.location.origin).href;
  try {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE);
    const deleted = await cache.delete(absoluteUrl);
    window.dispatchEvent(new CustomEvent('sonacast-offline-changed'));
    return deleted;
  } catch {
    return false;
  }
}
