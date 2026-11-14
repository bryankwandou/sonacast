import type { BlendRoom, CloudLibrarySnapshot, Track, UserPlaylist } from '../types';

const LISTENER_ID_KEY = 'sonacast_listener_id_v1';
const DISPLAY_NAME_KEY = 'sonacast_display_name_v1';

export interface ListenerIdentity {
  listenerId: string;
  displayName: string;
}

export function getOrCreateListenerIdentity(): ListenerIdentity {
  if (typeof window === 'undefined') {
    return { listenerId: 'lst_default', displayName: 'Listener' };
  }
  let listenerId = window.localStorage.getItem(LISTENER_ID_KEY) || '';
  if (!listenerId || !/^lst_[a-z0-9_]+$/i.test(listenerId)) {
    const rand = Math.random().toString(36).slice(2, 10);
    listenerId = `lst_${Date.now().toString(36)}_${rand}`;
    window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  }
  const displayName =
    window.localStorage.getItem(DISPLAY_NAME_KEY)?.trim() ||
    `Listener ${listenerId.slice(-4).toUpperCase()}`;
  return { listenerId, displayName };
}

export function saveListenerDisplayName(name: string): void {
  if (typeof window === 'undefined') return;
  const clean = name.trim().slice(0, 60);
  if (clean) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, clean);
  }
}

export function setAuthenticatedListenerIdentity(listenerId: string, displayName: string): void {
  if (typeof window === 'undefined') return;
  if (/^lst_[a-z0-9_]+$/i.test(listenerId)) {
    window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  }
  const cleanName = displayName.trim().slice(0, 60);
  if (cleanName) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, cleanName);
  }
}

export function rotateGuestListenerIdentity(): ListenerIdentity {
  if (typeof window === 'undefined') {
    return { listenerId: 'lst_default', displayName: 'Listener' };
  }
  const rand = Math.random().toString(36).slice(2, 10);
  const listenerId = `lst_${Date.now().toString(36)}_${rand}`;
  const displayName = `Listener ${listenerId.slice(-4).toUpperCase()}`;
  window.localStorage.setItem(LISTENER_ID_KEY, listenerId);
  window.localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  return { listenerId, displayName };
}

export async function fetchNeonLibrary(listenerId: string): Promise<CloudLibrarySnapshot | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`/api/library?listenerId=${encodeURIComponent(listenerId)}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as CloudLibrarySnapshot;
    return data && data.connected ? data : null;
  } catch {
    return null;
  }
}

let mutationChain: Promise<unknown> = Promise.resolve();

export function mutateNeonLibrary(
  action: string,
  payload: Record<string, unknown>
): Promise<CloudLibrarySnapshot | null> {
  const executeMutation = async (): Promise<CloudLibrarySnapshot | null> => {
    try {
      const { listenerId, displayName } = getOrCreateListenerIdentity();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listenerId,
          displayName,
          action,
          ...payload
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = (await res.json()) as CloudLibrarySnapshot;
      return data && data.connected ? data : null;
    } catch {
      return null;
    }
  };

  const next = mutationChain.then(executeMutation, executeMutation);
  mutationChain = next.catch(() => null);
  return next;
}

export async function fetchListenerBlends(listenerId: string): Promise<BlendRoom[]> {
  try {
    const res = await fetch(`/api/blend?listenerId=${encodeURIComponent(listenerId)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { blends?: BlendRoom[] };
    return Array.isArray(data.blends) ? data.blends : [];
  } catch {
    return [];
  }
}

export async function fetchBlendByCode(code: string): Promise<BlendRoom | null> {
  try {
    const res = await fetch(`/api/blend?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function createBlendInNeon(params: {
  title?: string;
  tracks: Track[];
  partnerName?: string;
  partnerId?: string;
  partnerTracks?: Track[];
}): Promise<BlendRoom | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_blend',
        listenerId,
        displayName,
        ...params
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function joinBlendInNeon(blendCode: string, tracks: Track[]): Promise<BlendRoom | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join_blend',
        listenerId,
        displayName,
        blendCode: blendCode.trim().toUpperCase(),
        tracks
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blend?: BlendRoom };
    return data.blend || null;
  } catch {
    return null;
  }
}

export async function deleteBlendInNeon(blendCode: string): Promise<BlendRoom[] | null> {
  try {
    const { listenerId } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_blend',
        listenerId,
        blendCode
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blends?: BlendRoom[] };
    return Array.isArray(data.blends) ? data.blends : [];
  } catch {
    return null;
  }
}

export async function fetchSharedAlbum(shareCode: string): Promise<UserPlaylist | null> {
  try {
    const res = await fetch(`/api/blend?albumCode=${encodeURIComponent(shareCode.trim().toUpperCase())}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { album?: UserPlaylist };
    return data.album || null;
  } catch {
    return null;
  }
}

export async function cloneSharedAlbumToNeon(
  shareCode: string
): Promise<CloudLibrarySnapshot | null> {
  try {
    const { listenerId, displayName } = getOrCreateListenerIdentity();
    const res = await fetch('/api/blend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clone_shared_album',
        listenerId,
        displayName,
        shareCode: shareCode.trim().toUpperCase()
      })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { snapshot?: CloudLibrarySnapshot };
    return data.snapshot || null;
  } catch {
    return null;
  }
}
