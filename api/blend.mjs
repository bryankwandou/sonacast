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

function makeCode(prefix) {
  return `${prefix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}${Math.floor(10 + Math.random() * 89)}`;
}

function primaryArtistLower(artist) {
  return String(artist || '')
    .split(/\s*(?:,|feat\.?|ft\.?|&| x )\s*/i)[0]
    .trim()
    .toLowerCase();
}

function buildTasteSummary(tracks, fallbackName = 'Listener') {
  const safeTracks = (Array.isArray(tracks) ? tracks : [])
    .map(normalizeTrackPayload)
    .filter(Boolean)
    .slice(0, 40);

  const artistMap = new Map();
  const genreMap = new Map();
  let bpmSum = 0;

  for (const t of safeTracks) {
    const artist = String(t.artist || '').split(/,|feat\.?|ft\.?|&/i)[0].trim();
    if (artist) artistMap.set(artist, (artistMap.get(artist) || 0) + 1);
    const genre = t.genre || 'Pop';
    genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    bpmSum += Number(t.bpm) || 120;
  }

  return {
    name: sanitizeText(fallbackName, 60, 'Listener'),
    artists: [...artistMap.keys()],
    genres: [...genreMap.keys()],
    avgBpm: safeTracks.length > 0 ? Math.round(bpmSum / safeTracks.length) : 118,
    tracks: safeTracks
  };
}

function computeBlendResult(profileA, profileB) {
  const tracksA = profileA.tracks || [];
  const tracksB = profileB.tracks || [];

  const artistSetA = new Set((profileA.artists || []).map((a) => a.toLowerCase()));
  const artistMapB = new Map((profileB.artists || []).map((a) => [a.toLowerCase(), a]));
  const sharedArtists = [];
  for (const [low, display] of artistMapB.entries()) {
    if (artistSetA.has(low)) sharedArtists.push(display);
  }

  const genreSetA = new Set((profileA.genres || []).map((g) => g.toLowerCase()));
  const genreMapB = new Map((profileB.genres || []).map((g) => [g.toLowerCase(), g]));
  const sharedGenres = [];
  for (const [low, display] of genreMapB.entries()) {
    if (genreSetA.has(low)) sharedGenres.push(display);
  }

  const bpmDelta = Math.abs((profileA.avgBpm || 118) - (profileB.avgBpm || 118));
  const bpmScore = Math.max(0, 28 - bpmDelta * 0.6);
  const unionArtists = Math.max(1, new Set([...artistSetA, ...artistMapB.keys()]).size);
  const artistScore = Math.min(40, (sharedArtists.length / unionArtists) * 110);
  const unionGenres = Math.max(1, new Set([...genreSetA, ...genreMapB.keys()]).size);
  const genreScore = Math.min(32, (sharedGenres.length / unionGenres) * 65);

  const matchScore = Math.max(
    46,
    Math.min(99, Math.round(32 + artistScore + genreScore + bpmScore))
  );

  // Interleave tracks from A and B deterministically without duplicate title+artist
  const seenKeys = new Set();
  const blended = [];
  const maxLen = Math.max(tracksA.length, tracksB.length);

  for (let i = 0; i < maxLen && blended.length < 36; i += 1) {
    const pair = [
      tracksA[i] ? { ...tracksA[i], sourceTag: `Blend · ${profileA.name}` } : null,
      tracksB[i] ? { ...tracksB[i], sourceTag: `Blend · ${profileB.name}` } : null
    ];
    for (const item of pair) {
      if (!item) continue;
      const key = `${item.title.toLowerCase()}::${primaryArtistLower(item.artist)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      blended.push(item);
    }
  }

  return {
    matchScore,
    sharedArtists: sharedArtists.slice(0, 8),
    sharedGenres: sharedGenres.slice(0, 8),
    blendedTracks: blended
  };
}

function formatBlendRow(row) {
  return {
    blendCode: row.blend_code,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    partnerId: row.partner_id || null,
    partnerName: row.partner_name || null,
    title: row.title,
    matchScore: Number(row.match_score) || 0,
    sharedArtists: Array.isArray(row.shared_artists) ? row.shared_artists : [],
    sharedGenres: Array.isArray(row.shared_genres) ? row.shared_genres : [],
    blendedTracks: Array.isArray(row.blended_tracks) ? row.blended_tracks : [],
    creatorProfile: row.creator_profile || {},
    partnerProfile: row.partner_profile || null,
    status: row.status || 'open',
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  };
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
      const code = sanitizeId(req.query?.code, '', 32).toUpperCase();
      const albumCode = sanitizeId(req.query?.albumCode, '', 32).toUpperCase();
      const listenerId = sanitizeId(req.query?.listenerId, '', 96);

      if (code) {
        const rows = await sql`
          SELECT * FROM music_blends WHERE blend_code = ${code} LIMIT 1
        `;
        if (rows.length === 0) {
          res.status(404).json({ error: 'Blend code not found' });
          return;
        }
        res.status(200).json({ blend: formatBlendRow(rows[0]) });
        return;
      }

      if (albumCode) {
        const albRows = await sql`
          SELECT id, listener_id, name, description, cover_url, share_code, is_public, created_at
          FROM albums
          WHERE share_code = ${albumCode} AND is_public = TRUE
          LIMIT 1
        `;
        if (albRows.length === 0) {
          res.status(404).json({ error: 'Shared album not found' });
          return;
        }
        const alb = albRows[0];
        const trackRows = await sql`
          SELECT track_json FROM album_tracks WHERE album_id = ${alb.id} ORDER BY position ASC
        `;
        res.status(200).json({
          album: {
            id: alb.id,
            name: alb.name,
            description: alb.description || '',
            coverUrl: alb.cover_url || trackRows[0]?.track_json?.coverUrl || '',
            shareCode: alb.share_code,
            tracks: trackRows.map((r) => r.track_json).filter(Boolean),
            createdAt: new Date(alb.created_at).getTime()
          }
        });
        return;
      }

      if (listenerId) {
        const rows = await sql`
          SELECT * FROM music_blends
          WHERE creator_id = ${listenerId} OR partner_id = ${listenerId}
          ORDER BY updated_at DESC
          LIMIT 25
        `;
        res.status(200).json({ blends: rows.map(formatBlendRow) });
        return;
      }

      const recentPublic = await sql`
        SELECT * FROM music_blends
        ORDER BY updated_at DESC
        LIMIT 12
      `;
      res.status(200).json({ blends: recentPublic.map(formatBlendRow) });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = await parseBody(req);
    const action = sanitizeText(body.action, 48);
    const listenerId = sanitizeId(body.listenerId, '', 96);
    if (!action || !listenerId) {
      res.status(400).json({ error: 'Missing action or listenerId' });
      return;
    }

    const displayName = sanitizeText(body.displayName, 60, 'Listener');
    await ensureListenerRow(sql, listenerId, displayName);

    if (action === 'create_blend') {
      const creatorSummary = buildTasteSummary(body.tracks, displayName);
      const partnerTracks = Array.isArray(body.partnerTracks) ? body.partnerTracks : [];
      const hasPartner = partnerTracks.length > 0 && sanitizeText(body.partnerName, 60);
      const blendCode = makeCode('BLND');

      if (hasPartner) {
        const partnerName = sanitizeText(body.partnerName, 60, 'Curated Mix');
        const partnerSummary = buildTasteSummary(partnerTracks, partnerName);
        const computed = computeBlendResult(creatorSummary, partnerSummary);
        const title = sanitizeText(
          body.title,
          96,
          `${creatorSummary.name} + ${partnerSummary.name}`
        );

        await sql`
          INSERT INTO music_blends (
            blend_code, creator_id, creator_name, partner_id, partner_name,
            title, match_score, shared_artists, shared_genres, blended_tracks,
            creator_profile, partner_profile, status
          )
          VALUES (
            ${blendCode}, ${listenerId}, ${creatorSummary.name}, ${sanitizeId(body.partnerId, 'persona', 96)},
            ${partnerSummary.name}, ${title}, ${computed.matchScore},
            ${JSON.stringify(computed.sharedArtists)}::jsonb,
            ${JSON.stringify(computed.sharedGenres)}::jsonb,
            ${JSON.stringify(computed.blendedTracks)}::jsonb,
            ${JSON.stringify(creatorSummary)}::jsonb,
            ${JSON.stringify(partnerSummary)}::jsonb,
            'matched'
          )
        `;
      } else {
        const title = sanitizeText(body.title, 96, `${creatorSummary.name} Blend`);
        await sql`
          INSERT INTO music_blends (
            blend_code, creator_id, creator_name, title, match_score,
            blended_tracks, creator_profile, status
          )
          VALUES (
            ${blendCode}, ${listenerId}, ${creatorSummary.name}, ${title}, 100,
            ${JSON.stringify(creatorSummary.tracks)}::jsonb,
            ${JSON.stringify(creatorSummary)}::jsonb,
            'open'
          )
        `;
      }

      const [created] = await sql`
        SELECT * FROM music_blends WHERE blend_code = ${blendCode} LIMIT 1
      `;
      res.status(200).json({ blend: formatBlendRow(created) });
      return;
    }

    if (action === 'join_blend') {
      const code = sanitizeId(body.blendCode, '', 32).toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'Missing blendCode' });
        return;
      }
      const existing = await sql`
        SELECT * FROM music_blends WHERE blend_code = ${code} LIMIT 1
      `;
      if (existing.length === 0) {
        res.status(404).json({ error: 'Blend code not found' });
        return;
      }
      const row = existing[0];
      const partnerSummary = buildTasteSummary(body.tracks, displayName);
      const creatorSummary = row.creator_profile || { name: row.creator_name, tracks: [] };
      const computed = computeBlendResult(creatorSummary, partnerSummary);
      const mergedTitle = `${row.creator_name} + ${partnerSummary.name}`;

      await sql`
        UPDATE music_blends
        SET
          partner_id = ${listenerId},
          partner_name = ${partnerSummary.name},
          title = ${mergedTitle},
          match_score = ${computed.matchScore},
          shared_artists = ${JSON.stringify(computed.sharedArtists)}::jsonb,
          shared_genres = ${JSON.stringify(computed.sharedGenres)}::jsonb,
          blended_tracks = ${JSON.stringify(computed.blendedTracks)}::jsonb,
          partner_profile = ${JSON.stringify(partnerSummary)}::jsonb,
          status = 'matched',
          updated_at = NOW()
        WHERE blend_code = ${code}
      `;

      const [updated] = await sql`
        SELECT * FROM music_blends WHERE blend_code = ${code} LIMIT 1
      `;
      res.status(200).json({ blend: formatBlendRow(updated) });
      return;
    }

    if (action === 'delete_blend') {
      const code = sanitizeId(body.blendCode, '', 32).toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'Missing blendCode' });
        return;
      }
      await sql`
        DELETE FROM music_blends
        WHERE blend_code = ${code} AND (creator_id = ${listenerId} OR partner_id = ${listenerId})
      `;
      const rows = await sql`
        SELECT * FROM music_blends
        WHERE creator_id = ${listenerId} OR partner_id = ${listenerId}
        ORDER BY updated_at DESC
        LIMIT 25
      `;
      res.status(200).json({ blends: rows.map(formatBlendRow) });
      return;
    }

    if (action === 'clone_shared_album') {
      const shareCode = sanitizeId(body.shareCode, '', 32).toUpperCase();
      if (!shareCode) {
        res.status(400).json({ error: 'Missing shareCode' });
        return;
      }
      const srcRows = await sql`
        SELECT * FROM albums WHERE share_code = ${shareCode} AND is_public = TRUE LIMIT 1
      `;
      if (srcRows.length === 0) {
        res.status(404).json({ error: 'Shared album not found' });
        return;
      }
      const src = srcRows[0];
      const srcTracks = await sql`
        SELECT track_id, position, track_json FROM album_tracks WHERE album_id = ${src.id} ORDER BY position ASC
      `;
      const newId = `alb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const newShareCode = makeCode('ALB');
      await sql`
        INSERT INTO albums (id, listener_id, name, description, cover_url, share_code, is_public)
        VALUES (
          ${newId}, ${listenerId}, ${`${src.name}`.slice(0, 80)}, ${src.description || ''},
          ${src.cover_url || ''}, ${newShareCode}, TRUE
        )
      `;
      for (const tr of srcTracks) {
        if (!tr.track_json) continue;
        await sql`
          INSERT INTO album_tracks (album_id, track_id, position, track_json)
          VALUES (${newId}, ${tr.track_id}, ${tr.position}, ${JSON.stringify(tr.track_json)}::jsonb)
          ON CONFLICT (album_id, track_id) DO NOTHING
        `;
      }
      const snapshot = await fetchLibrarySnapshot(sql, listenerId);
      res.status(200).json({ snapshot, clonedAlbumId: newId });
      return;
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch {
    res.status(500).json({ connected: false, error: 'Blend operation failed' });
  }
}

