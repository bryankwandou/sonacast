import type React from 'react';

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getInitials(title?: string, artist?: string): string {
  const source = (title || artist || 'SC').trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || 'SC';
}

/**
 * Generates an inline SVG data URI cover so album artwork never renders
 * browser broken-image icons when an external CDN is unreachable or offline.
 */
export function buildCoverFallbackDataUri(title?: string, artist?: string): string {
  const initials = escapeXml(getInitials(title, artist));
  const label = escapeXml((artist || title || 'Sonacast Master').slice(0, 22));

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">',
    '  <defs>',
    '    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" stop-color="#09111E"/>',
    '      <stop offset="55%" stop-color="#0F1F2E"/>',
    '      <stop offset="100%" stop-color="#0B2D26"/>',
    '    </linearGradient>',
    '    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" stop-color="#10B981"/>',
    '      <stop offset="100%" stop-color="#06B6D4"/>',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="320" height="320" rx="28" fill="url(#bg)"/>',
    '  <circle cx="160" cy="148" r="88" fill="none" stroke="url(#ring)" stroke-width="4" opacity="0.85"/>',
    '  <circle cx="160" cy="148" r="64" fill="none" stroke="#10B981" stroke-width="1.5" opacity="0.35"/>',
    '  <circle cx="160" cy="148" r="40" fill="#0A1220" stroke="#34D399" stroke-width="2" opacity="0.95"/>',
    `  <text x="160" y="158" text-anchor="middle" fill="#ECFEFF" font-family="system-ui,-apple-system,sans-serif" font-size="28" font-weight="800" letter-spacing="1">${initials}</text>`,
    `  <text x="160" y="276" text-anchor="middle" fill="#6EE7B7" font-family="ui-monospace,SFMono-Regular,monospace" font-size="13" font-weight="600">${label}</text>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_COVER_DATA_URI = buildCoverFallbackDataUri('Sonacast', 'Full Master');

/**
 * Safely replaces broken <img> sources once without triggering reload loops.
 */
export function applyCoverFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  title?: string,
  artist?: string,
): void {
  const img = event.currentTarget;
  const fallback = buildCoverFallbackDataUri(title, artist);
  if (img.dataset.fallbackUrl === img.src || img.src.startsWith('data:image/svg+xml')) {
    return;
  }
  img.dataset.fallbackUrl = fallback;
  img.src = fallback;
}

