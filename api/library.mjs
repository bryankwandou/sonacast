import crypto from 'node:crypto';
import {
  ensureListenerRow,
  ensureSchema,
  fetchLibrarySnapshot,
  getSql,
  normalizeTrackPayload,
  parseBody,
  sanitizeId,
  sanitizeText
} from './_db.mjs';

function makeShareCode(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sql = getSql();
  if (!sql) {
    res.status(503).json({ connected: false, error: 'Database not configured' });
    return;
  }

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const listenerId = sanitizeId(req.query?.listenerId, '', 96);
      if (!listenerId) {
        res.status(400).json({ error: 'Missing listenerId' });
        return;
      }
      const snapshot = await fetchLibrarySnapshot(sql, listenerId);
      res.status(200).json(snapshot);
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = await parseBody(req);
    const listenerId = sanitizeId(body.listenerId, '', 96);
    const action = sanitizeText(body.action, 48);
    if (!listenerId || !action) {
      res.status(400).json({ error: 'Missing listenerId or action' });
      return;
    }

    await ensureListenerRow(sql, listenerId, body.displayName || 'Listener');

    if (action === 'upsert_profile') {
      const displayName = sanitizeText(body.displayName, 60, 'Listener');
      const rawHandle = sanitizeText(body.handle, 32, displayName)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '');
      const handle = '@' + (rawHandle || 'listener');
      const bio = sanitizeText(body.bio, 240, '');
      await sql`
        UPDATE listeners
        SET display_name = ${displayName}, handle = ${handle}, bio = ${bio}, updated_at = NOW()
        WHERE listener_id = ${listenerId}
      `;
    } else if (action === 'toggle_favorite') {
      const track = normalizeTrackPayload(body.track);
      if (!track) {
        res.status(400).json({ error: 'Invalid track payload' });
        return;
      }
      const existing = await sql`
        SELECT 1 FROM favorites WHERE listener_id = ${listenerId} AND track_id = ${track.id} LIMIT 1
      `;
      if (existing.length > 0 && body.forceState !== true) {
        await sql`
          DELETE FROM favorites WHERE listener_id = ${listenerId} AND track_id = ${track.id}
        `;
      } else {
        await sql`
          INSERT INTO favorites (
            listener_id, track_id, title, artist, album, duration, cover_url, genre, bpm, track_json
          )
          VALUES (
            ${listenerId}, ${track.id}, ${track.title}, ${track.artist}, ${track.album},
            ${track.duration}, ${track.coverUrl}, ${track.genre}, ${track.bpm}, ${JSON.stringify(track)}::jsonb
          )
          ON CONFLICT (listener_id, track_id) DO UPDATE SET
            title = EXCLUDED.title,
            artist = EXCLUDED.artist,
            album = EXCLUDED.album,
            cover_url = EXCLUDED.cover_url,
            track_json = EXCLUDED.track_json
        `;
      }
    } else if (action === 'update_favorite_meta') {
      const trackId = sanitizeId(body.trackId, '', 120);
      if (!trackId) {
        res.status(400).json({ error: 'Missing trackId' });
        return;
      }
      const note = typeof body.note === 'string' ? sanitizeText(body.note, 500, '') : null;
      const hasPinned = typeof body.pinned === 'boolean';
      if (note !== null && hasPinned) {
        await sql`
          UPDATE favorites
          SET note = ${note}, pinned = ${body.pinned}
          WHERE listener_id = ${listenerId} AND track_id = ${trackId}
        `;
      } else if (note !== null) {
        await sql`
          UPDATE favorites
          SET note = ${note}
          WHERE listener_id = ${listenerId} AND track_id = ${trackId}
        `;
      } else if (hasPinned) {
        await sql`
          UPDATE favorites
          SET pinned = ${body.pinned}
          WHERE listener_id = ${listenerId} AND track_id = ${trackId}
        `;
      }
    } else if (action === 'create_album') {
      const name = sanitizeText(body.name, 80);
      if (!name) {
        res.status(400).json({ error: 'Album name is required' });
        return;
      }
      const description = sanitizeText(body.description, 240, '');
      const isPublic = body.isPublic !== false;
      const albumId = `alb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const shareCode = makeShareCode('ALB');
      const initialTrack = body.initialTrack ? normalizeTrackPayload(body.initialTrack) : null;
      const coverUrl = sanitizeText(body.coverUrl, 1000, initialTrack?.coverUrl || '');

      await sql`
        INSERT INTO albums (id, listener_id, name, description, cover_url, share_code, is_public)
        VALUES (${albumId}, ${listenerId}, ${name}, ${description}, ${coverUrl}, ${shareCode}, ${isPublic})
      `;

      if (initialTrack) {
        await sql`
          INSERT INTO album_tracks (album_id, track_id, position, track_json)
          VALUES (${albumId}, ${initialTrack.id}, 0, ${JSON.stringify(initialTrack)}::jsonb)
          ON CONFLICT (album_id, track_id) DO NOTHING
        `;
      }
    } else if (action === 'rename_album') {
      const albumId = sanitizeId(body.albumId, '', 96);
      const name = sanitizeText(body.name, 80);
      const description = sanitizeText(body.description, 240, '');
      if (!albumId || !name) {
        res.status(400).json({ error: 'Missing albumId or name' });
        return;
      }
      await sql`
        UPDATE albums
        SET name = ${name}, description = ${description}, updated_at = NOW()
        WHERE id = ${albumId} AND listener_id = ${listenerId}
      `;
    } else if (action === 'delete_album') {
      const albumId = sanitizeId(body.albumId, '', 96);
      if (!albumId) {
        res.status(400).json({ error: 'Missing albumId' });
        return;
      }
      await sql`DELETE FROM albums WHERE id = ${albumId} AND listener_id = ${listenerId}`;
    } else if (action === 'add_to_album') {
      const albumId = sanitizeId(body.albumId, '', 96);
      const track = normalizeTrackPayload(body.track);
      if (!albumId || !track) {
        res.status(400).json({ error: 'Missing albumId or valid track' });
        return;
      }
      const owned = await sql`
        SELECT id, cover_url FROM albums WHERE id = ${albumId} AND listener_id = ${listenerId} LIMIT 1
      `;
      if (owned.length === 0) {
        res.status(404).json({ error: 'Album not found' });
        return;
      }
      const posRow = await sql`
        SELECT COALESCE(MAX(position), -1)::int AS max_pos FROM album_tracks WHERE album_id = ${albumId}
      `;
      const nextPos = Number(posRow[0]?.max_pos ?? -1) + 1;

      await sql`
        INSERT INTO album_tracks (album_id, track_id, position, track_json)
        VALUES (${albumId}, ${track.id}, ${nextPos}, ${JSON.stringify(track)}::jsonb)
        ON CONFLICT (album_id, track_id) DO NOTHING
      `;
      if (!owned[0].cover_url && track.coverUrl) {
        await sql`
          UPDATE albums SET cover_url = ${track.coverUrl}, updated_at = NOW() WHERE id = ${albumId}
        `;
      } else {
        await sql`UPDATE albums SET updated_at = NOW() WHERE id = ${albumId}`;
      }
    } else if (action === 'remove_from_album') {
      const albumId = sanitizeId(body.albumId, '', 96);
      const trackId = sanitizeId(body.trackId, '', 120);
      if (!albumId || !trackId) {
        res.status(400).json({ error: 'Missing albumId or trackId' });
        return;
      }
      const owned = await sql`
        SELECT id FROM albums WHERE id = ${albumId} AND listener_id = ${listenerId} LIMIT 1
      `;
      if (owned.length === 0) {
        res.status(404).json({ error: 'Album not found' });
        return;
      }
      await sql`DELETE FROM album_tracks WHERE album_id = ${albumId} AND track_id = ${trackId}`;
      await sql`UPDATE albums SET updated_at = NOW() WHERE id = ${albumId}`;
    } else if (action === 'toggle_follow_artist') {
      const artistName = sanitizeText(body.artistName, 120);
      const genre = sanitizeText(body.genre, 64, 'Pop');
      if (!artistName) {
        res.status(400).json({ error: 'Missing artistName' });
        return;
      }
      const existing = await sql`
        SELECT 1 FROM followed_artists WHERE listener_id = ${listenerId} AND artist_name = ${artistName} LIMIT 1
      `;
      if (existing.length > 0) {
        await sql`
          DELETE FROM followed_artists WHERE listener_id = ${listenerId} AND artist_name = ${artistName}
        `;
      } else {
        await sql`
          INSERT INTO followed_artists (listener_id, artist_name, genre)
          VALUES (${listenerId}, ${artistName}, ${genre})
          ON CONFLICT (listener_id, artist_name) DO NOTHING
        `;
      }
    } else if (action === 'record_play') {
      const track = normalizeTrackPayload(body.track);
      if (!track) {
        res.status(400).json({ error: 'Invalid track payload' });
        return;
      }
      await sql`
        INSERT INTO play_history (listener_id, track_id, title, artist, genre, duration, track_json)
        VALUES (${listenerId}, ${track.id}, ${track.title}, ${track.artist}, ${track.genre}, ${track.duration}, ${JSON.stringify(track)}::jsonb)
      `;
    } else if (action === 'clear_history') {
      await sql`DELETE FROM play_history WHERE listener_id = ${listenerId}`;
    } else if (action === 'record_search') {
      const q = sanitizeText(body.query, 120);
      const mode = body.mode === 'albums' ? 'albums' : 'songs';
      const matchedTrack = body.track ? normalizeTrackPayload(body.track) : null;
      if (!q && !matchedTrack) {
        res.status(400).json({ error: 'Search query or track required' });
        return;
      }
      const finalQuery = q || `${matchedTrack.title} ${matchedTrack.artist}`.slice(0, 120);
      if (matchedTrack) {
        await sql`
          DELETE FROM search_history
          WHERE listener_id = ${listenerId} AND track_json->>'id' = ${matchedTrack.id}
        `;
      } else {
        await sql`
          DELETE FROM search_history
          WHERE listener_id = ${listenerId} AND LOWER(query) = LOWER(${finalQuery}) AND mode = ${mode} AND track_json IS NULL
        `;
      }
      await sql`
        INSERT INTO search_history (listener_id, query, mode, track_json)
        VALUES (${listenerId}, ${finalQuery}, ${mode}, ${matchedTrack ? JSON.stringify(matchedTrack) : null}::jsonb)
      `;
    } else if (action === 'delete_search_item') {
      const itemId = sanitizeId(body.id, '', 48);
      const query = sanitizeText(body.query, 120, '');
      if (itemId && /^\d+$/.test(itemId)) {
        await sql`DELETE FROM search_history WHERE listener_id = ${listenerId} AND id = ${Number(itemId)}`;
      } else if (query) {
        await sql`DELETE FROM search_history WHERE listener_id = ${listenerId} AND LOWER(query) = LOWER(${query})`;
      }
    } else if (action === 'clear_search_history') {
      await sql`DELETE FROM search_history WHERE listener_id = ${listenerId}`;
    } else if (action === 'sync_local_state') {
      const localFavs = Array.isArray(body.favorites) ? body.favorites.slice(0, 60) : [];
      for (const rawTrack of localFavs) {
        const track = normalizeTrackPayload(rawTrack);
        if (!track) continue;
        await sql`
          INSERT INTO favorites (
            listener_id, track_id, title, artist, album, duration, cover_url, genre, bpm, track_json
          )
          VALUES (
            ${listenerId}, ${track.id}, ${track.title}, ${track.artist}, ${track.album},
            ${track.duration}, ${track.coverUrl}, ${track.genre}, ${track.bpm}, ${JSON.stringify(track)}::jsonb
          )
          ON CONFLICT (listener_id, track_id) DO NOTHING
        `;
      }
      const localAlbums = Array.isArray(body.albums) ? body.albums.slice(0, 20) : [];
      for (const alb of localAlbums) {
        const albId = sanitizeId(alb?.id, '', 96);
        const albName = sanitizeText(alb?.name, 80);
        if (!albId || !albName) continue;
        const shareCode = makeShareCode('ALB');
        const albTracks = Array.isArray(alb?.tracks) ? alb.tracks.slice(0, 60) : [];
        const firstCover = albTracks[0]?.coverUrl || '';
        await sql`
          INSERT INTO albums (id, listener_id, name, description, cover_url, share_code, is_public)
          VALUES (${albId}, ${listenerId}, ${albName}, '', ${String(firstCover).slice(0, 1000)}, ${shareCode}, TRUE)
          ON CONFLICT (id) DO NOTHING
        `;
        for (let i = 0; i < albTracks.length; i += 1) {
          const t = normalizeTrackPayload(albTracks[i]);
          if (!t) continue;
          await sql`
            INSERT INTO album_tracks (album_id, track_id, position, track_json)
            VALUES (${albId}, ${t.id}, ${i}, ${JSON.stringify(t)}::jsonb)
            ON CONFLICT (album_id, track_id) DO NOTHING
          `;
        }
      }
    } else {
      res.status(400).json({ error: 'Unknown action' });
      return;
    }

    const snapshot = await fetchLibrarySnapshot(sql, listenerId);
    res.status(200).json(snapshot);
  } catch {
    res.status(500).json({ connected: false, error: 'Library operation failed' });
  }
}

