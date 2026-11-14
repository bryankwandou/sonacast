import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Disc3,
  FolderPlus,
  Heart,
  Loader2,
  Play,
  Shuffle,
  Sparkles,
  Trash2,
  Users
} from 'lucide-react';
import type { BlendRoom, FavoriteTrack, Track } from '../../types';
import { ARTISTS_DIRECTORY } from '../../data/artists800';
import { searchTracksOnline } from '../../services/musicService';
import {
  createBlendInNeon,
  deleteBlendInNeon,
  fetchBlendByCode,
  joinBlendInNeon
} from '../../services/neonSyncService';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { applyCoverFallback, DEFAULT_COVER_DATA_URI } from '../../utils/coverFallback';

interface BlendViewProps {
  listenerName: string;
  favorites: FavoriteTrack[];
  recentTracks: Track[];
  catalogTracks: Track[];
  blends: BlendRoom[];
  initialBlendCode?: string | null;
  isCloudConnected: boolean;
  currentTrack: Track;
  onSelectTrack: (track: Track) => void;
  onPlayTrackList: (tracks: Track[], shuffle?: boolean) => void;
  onRefreshBlends: () => Promise<void>;
  onSaveBlendAsAlbum: (name: string, tracks: Track[]) => Promise<void>;
  onOpenAddToAlbum: (track: Track) => void;
  onToggleLike: (track: Track) => void;
  likedTrackIds: Set<string>;
}

const CURATED_BLEND_PERSONAS: {
  id: string;
  name: string;
  subtitle: string;
  seedArtists: string[];
  avgBpm: number;
}[] = [
  {
    id: 'indo-classics',
    name: 'Nusantara Pop & Classics',
    subtitle: 'Tulus · NOAH · Sheila On 7 · Dewa 19 · Tiara Andini',
    seedArtists: ['Tulus', 'NOAH', 'Sheila On 7'],
    avgBpm: 96
  },
  {
    id: 'global-arena',
    name: 'Global Icons & Arena',
    subtitle: 'The Weeknd · Taylor Swift · Queen · Coldplay · Bruno Mars',
    seedArtists: ['The Weeknd', 'Taylor Swift', 'Queen'],
    avgBpm: 122
  },
  {
    id: 'tokyo-citypop',
    name: 'Tokyo Night & J-Pop',
    subtitle: 'YOASOBI · Fujii Kaze · Kenshi Yonezu · Ado · Eve',
    seedArtists: ['YOASOBI', 'Fujii Kaze', 'Kenshi Yonezu'],
    avgBpm: 128
  },
  {
    id: 'seoul-studio',
    name: 'Seoul Studio & K-Pop',
    subtitle: 'NewJeans · BTS · BLACKPINK · IU · aespa',
    seedArtists: ['NewJeans', 'BTS', 'BLACKPINK'],
    avgBpm: 124
  }
];

export const BlendView: React.FC<BlendViewProps> = ({
  listenerName,
  favorites,
  recentTracks,
  catalogTracks,
  blends,
  initialBlendCode,
  isCloudConnected,
  currentTrack,
  onSelectTrack,
  onPlayTrackList,
  onRefreshBlends,
  onSaveBlendAsAlbum,
  onOpenAddToAlbum,
  onToggleLike,
  likedTrackIds
}) => {
  const { t } = useAppPreferences();
  const [selectedBlend, setSelectedBlend] = useState<BlendRoom | null>(blends[0] || null);
  const [joinCodeInput, setJoinCodeInput] = useState(initialBlendCode || '');
  const [artistA, setArtistA] = useState('The Weeknd');
  const [artistB, setArtistB] = useState('Tulus');
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [savedAlbumOk, setSavedAlbumOk] = useState(false);

  const mySeedTracks = useMemo(() => {
    const merged: Track[] = [];
    const seen = new Set<string>();
    for (const list of [favorites, recentTracks, catalogTracks.slice(0, 8)]) {
      for (const item of list) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
        if (merged.length >= 24) return merged;
      }
    }
    return merged;
  }, [favorites, recentTracks, catalogTracks]);

  const myTasteProfile = useMemo(() => {
    const genres = new Map<string, number>();
    const artists = new Map<string, number>();
    let bpmTotal = 0;
    for (const tr of mySeedTracks) {
      const g = tr.genre || 'Pop';
      genres.set(g, (genres.get(g) || 0) + 1);
      const a = tr.artist.split(/,|feat|ft|&/i)[0].trim();
      if (a) artists.set(a, (artists.get(a) || 0) + 1);
      bpmTotal += tr.bpm || 118;
    }
    return {
      topGenres: [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
      topArtists: [...artists.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
      avgBpm: mySeedTracks.length > 0 ? Math.round(bpmTotal / mySeedTracks.length) : 118
    };
  }, [mySeedTracks]);

  useEffect(() => {
    if (!selectedBlend && blends.length > 0) {
      setSelectedBlend(blends[0]);
    }
  }, [blends, selectedBlend]);

  useEffect(() => {
    if (!initialBlendCode) return;
    setJoinCodeInput(initialBlendCode);
    fetchBlendByCode(initialBlendCode).then((found) => {
      if (found) setSelectedBlend(found);
    });
  }, [initialBlendCode]);

  const handleCopyInviteLink = (code: string) => {
    const link = `${window.location.origin}/?blend=${encodeURIComponent(code)}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleCreateFriendInvite = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const created = await createBlendInNeon({
        title: `${listenerName} Blend`,
        tracks: mySeedTracks
      });
      if (created) {
        setSelectedBlend(created);
        setStatusMessage(`Blend room ${created.blendCode} saved in Neon Postgres.`);
        await onRefreshBlends();
      } else {
        setStatusMessage('Unable to create remote Blend right now.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinBlendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const joined = await joinBlendInNeon(code, mySeedTracks);
      if (joined) {
        setSelectedBlend(joined);
        setStatusMessage(`Matched ${joined.matchScore}% with ${joined.creatorName}!`);
        await onRefreshBlends();
      } else {
        setStatusMessage(`Blend code ${code} was not found.`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handlePersonaBlend = async (persona: (typeof CURATED_BLEND_PERSONAS)[number]) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const onlineBatches = await Promise.all(
        persona.seedArtists.slice(0, 2).map((name) => searchTracksOnline(name).catch(() => []))
      );
      const partnerTracks = onlineBatches.flat().slice(0, 14);
      const fallbackPartner = catalogTracks.filter((tr) =>
        persona.seedArtists.some((a) => tr.artist.toLowerCase().includes(a.toLowerCase()))
      );
      const finalPartnerTracks = partnerTracks.length > 0 ? partnerTracks : fallbackPartner;

      const created = await createBlendInNeon({
        title: `${listenerName} × ${persona.name}`,
        tracks: mySeedTracks,
        partnerId: `persona_${persona.id}`,
        partnerName: persona.name,
        partnerTracks: finalPartnerTracks
      });
      if (created) {
        setSelectedBlend(created);
        setStatusMessage(`Saved ${created.title} (${created.matchScore}% Match) in Neon Postgres.`);
        await onRefreshBlends();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleArtistDuoBlend = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = artistA.trim();
    const b = artistB.trim();
    if (!a || !b) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const [tracksA, tracksB] = await Promise.all([
        searchTracksOnline(a).catch(() => []),
        searchTracksOnline(b).catch(() => [])
      ]);
      const created = await createBlendInNeon({
        title: `${a} × ${b} Blend`,
        tracks: tracksA.length > 0 ? tracksA.slice(0, 14) : mySeedTracks,
        partnerId: `duo_${b.toLowerCase().replace(/\s+/g, '_')}`,
        partnerName: b,
        partnerTracks: tracksB.length > 0 ? tracksB.slice(0, 14) : catalogTracks.slice(0, 10)
      });
      if (created) {
        setSelectedBlend(created);
        setStatusMessage(`Artist Duo Blend ${created.blendCode} generated in Neon Postgres.`);
        await onRefreshBlends();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteRoom = async (code: string) => {
    const remaining = await deleteBlendInNeon(code);
    if (remaining) {
      if (selectedBlend?.blendCode === code) {
        setSelectedBlend(remaining[0] || null);
      }
      await onRefreshBlends();
    }
  };

  return (
    <div className="space-y-6 pb-8" data-testid="blend-music-view">
      {/* Editorial Hero & Audio Taste Fingerprint */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                isCloudConnected
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-medium)] text-[var(--text-secondary)]'
              }`}
            >
              <Cloud size={12} />
              <span>{isCloudConnected ? 'Neon Postgres Multi-Listener Sync' : 'Local Mode'}</span>
            </span>

            <h1 className="font-editorial text-2xl sm:text-4xl text-[var(--text-primary)]">
              {t.musicBlendHeading}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
              {t.musicBlendDesc}
            </p>
          </div>

          <button
            type="button"
            data-testid="create-friend-blend-btn"
            disabled={isBusy}
            onClick={handleCreateFriendInvite}
            className="min-h-[42px] px-5 py-2.5 rounded-full bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold inline-flex items-center gap-2 hover:opacity-90 cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            <span>{t.createBlendBtn}</span>
          </button>
        </div>

        {/* Listener Taste Fingerprint + Join Code Input */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-[var(--border-subtle)]">
          <div className="lg:col-span-7 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              Your Taste Fingerprint &middot; {listenerName} &middot; {myTasteProfile.avgBpm} Avg BPM
            </p>
            <div className="flex flex-wrap gap-1.5">
              {myTasteProfile.topArtists.map((a) => (
                <span
                  key={a}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]"
                >
                  {a}
                </span>
              ))}
              {myTasteProfile.topGenres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs font-medium text-[var(--accent-text)]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleJoinBlendSubmit}
            className="lg:col-span-5 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2"
          >
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)] block">
              {t.joinBlendLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                data-testid="join-blend-code-input"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="BLND-XXXX"
                className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono uppercase text-[var(--text-primary)]"
              />
              <button
                type="submit"
                data-testid="join-blend-submit-btn"
                disabled={isBusy}
                className="h-9 px-4 rounded-lg bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60"
              >
                Match
              </button>
            </div>
          </form>
        </div>

        {statusMessage && (
          <p className="text-xs font-medium text-[var(--accent-text)]">{statusMessage}</p>
        )}
      </div>

      {/* Curated Blend Modes + Custom Two-Artist Blend Generator */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
            1-Click Taste Blend Rooms
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CURATED_BLEND_PERSONAS.map((persona) => (
              <button
                key={persona.id}
                type="button"
                data-testid={`persona-blend-${persona.id}`}
                disabled={isBusy}
                onClick={() => handlePersonaBlend(persona)}
                className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] text-left space-y-1.5 cursor-pointer transition-colors disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {persona.name}
                  </span>
                  <Sparkles size={14} className="text-[var(--accent-text)] shrink-0" />
                </div>
                <p className="text-xs text-[var(--text-secondary)] truncate">{persona.subtitle}</p>
                <p className="text-[11px] font-mono text-[var(--text-dim)]">
                  Target {persona.avgBpm} BPM
                </p>
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleArtistDuoBlend}
          className="xl:col-span-5 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
              Artist &times; Artist Blend Mixer
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Pick any two indexed artists to calculate similarity and interleave a live Blend album.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              list="sonacast-artist-list"
              value={artistA}
              onChange={(e) => setArtistA(e.target.value)}
              placeholder="Artist A..."
              className="h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <input
              type="text"
              list="sonacast-artist-list"
              value={artistB}
              onChange={(e) => setArtistB(e.target.value)}
              placeholder="Artist B..."
              className="h-10 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <datalist id="sonacast-artist-list">
              {ARTISTS_DIRECTORY.slice(0, 120).map((a) => (
                <option key={a.name} value={a.name} />
              ))}
            </datalist>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full h-10 rounded-xl bg-[var(--ink-solid)] text-[var(--ink-solid-fg)] text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            Generate Duo Blend
          </button>
        </form>
      </div>

      {/* Saved Blend Rooms + Active Blend Mix Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
            Saved Blend Rooms ({blends.length})
          </p>
          {blends.length === 0 ? (
            <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-dim)]">
              Create or trigger any Taste Blend above to save it to Neon Postgres.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {blends.map((room) => {
                const active = selectedBlend?.blendCode === room.blendCode;
                return (
                  <div
                    key={room.blendCode}
                    onClick={() => setSelectedBlend(room)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedBlend(room);
                      }
                    }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {room.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] font-mono text-[10px] text-[var(--accent-text)] shrink-0">
                          {room.matchScore}%
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[var(--text-dim)]">
                        {room.blendCode} &middot; {room.blendedTracks.length} tracks
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoom(room.blendCode);
                      }}
                      aria-label="Delete Blend"
                      className="w-8 h-8 rounded-lg text-[var(--text-dim)] hover:text-red-400 flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Selected Blend Showcase */}
        <div className="lg:col-span-8">
          {!selectedBlend ? (
            <div className="p-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-2">
              <Disc3 size={28} className="mx-auto text-[var(--text-dim)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Select or generate a Music Blend
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Blends combine listening history, artists, genres, and BPM overlap into one continuous mix.
              </p>
            </div>
          ) : (
            <div
              data-testid="active-blend-detail"
              className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] font-mono text-xs font-bold text-[var(--accent-text)]">
                      {selectedBlend.matchScore}% Taste Match
                    </span>
                    <span className="text-xs font-mono text-[var(--text-dim)]">
                      {selectedBlend.blendCode}
                    </span>
                  </div>
                  <h2 className="font-editorial text-2xl sm:text-3xl text-[var(--text-primary)] truncate">
                    {selectedBlend.title}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {selectedBlend.sharedArtists.length > 0
                      ? `Shared Artists: ${selectedBlend.sharedArtists.join(', ')}`
                      : `Genres: ${selectedBlend.sharedGenres.join(', ') || 'Cross-Genre Discovery'}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyInviteLink(selectedBlend.blendCode)}
                    className="min-h-[36px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCode === selectedBlend.blendCode ? (
                      <Check size={13} className="text-[var(--accent-text)]" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>Share Blend</span>
                  </button>

                  {selectedBlend.blendedTracks.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSaveBlendAsAlbum(
                            selectedBlend.title,
                            selectedBlend.blendedTracks
                          );
                          setSavedAlbumOk(true);
                          setTimeout(() => setSavedAlbumOk(false), 2000);
                        }}
                        className="min-h-[36px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderPlus size={13} />
                        <span>{savedAlbumOk ? 'Saved Album' : 'Save as Album'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPlayTrackList(selectedBlend.blendedTracks, false)}
                        className="min-h-[36px] px-4 rounded-xl bg-[var(--accent-emerald)] text-[var(--accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play size={13} className="fill-current" />
                        <span>Play Blend</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPlayTrackList(selectedBlend.blendedTracks, true)}
                        aria-label="Shuffle Blend"
                        className="min-h-[36px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
                      >
                        <Shuffle size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {selectedBlend.blendedTracks.map((tr, idx) => {
                  const playing = tr.id === currentTrack.id;
                  const liked = likedTrackIds.has(tr.id);
                  return (
                    <div
                      key={`${tr.id}-${idx}`}
                      className={`p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                        playing
                          ? 'bg-[var(--accent-soft)]'
                          : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTrack(tr)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="text-[11px] font-mono text-[var(--text-dim)] w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <img
                          src={tr.coverUrl || DEFAULT_COVER_DATA_URI}
                          alt={tr.title}
                          onError={(e) => applyCoverFallback(e, tr.title, tr.artist)}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[var(--bg-surface)]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {tr.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">
                            {tr.artist}
                            {tr.sourceTag ? ` · ${tr.sourceTag}` : ''}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenAddToAlbum(tr)}
                          title={t.addToAlbum}
                          className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                        >
                          <FolderPlus size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleLike(tr)}
                          title={t.likedSongs}
                          className={`w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center cursor-pointer ${
                            liked ? 'text-[var(--accent-text)]' : 'text-[var(--text-dim)]'
                          }`}
                        >
                          <Heart size={13} className={liked ? 'fill-current' : ''} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

