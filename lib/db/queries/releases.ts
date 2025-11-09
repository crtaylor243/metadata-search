import { sql } from '@/lib/db';
import { DbReleaseWithTracks } from '@/lib/types';

/**
 * Get detailed release information with all related metadata
 *
 * @param releaseId - The release ID to fetch details for
 * @returns Release with aggregated artists, labels, formats, genres, and styles
 *
 * Query features:
 * - Aggregates artists with proper ANV (artist name variation) handling
 * - Aggregates labels with catalog numbers
 * - Aggregates all format information (name, qty, descriptions)
 * - Aggregates genres and styles
 * - Uses COALESCE(anv, name) for artist display names
 * - Returns comprehensive release metadata for display and export
 *
 * Note: This query returns release metadata only.
 * Track details with credits should be fetched separately if needed.
 */
export async function getReleaseDetails(
  releaseId: number
): Promise<DbReleaseWithTracks | null> {
  // Validate input
  if (!releaseId || releaseId <= 0) {
    return null;
  }

  const rows = await sql`
    SELECT
      r.id,
      r.title,
      r.released,
      r.country,
      r.notes,
      ARRAY_AGG(DISTINCT ra.artist_id ORDER BY ra.artist_id) FILTER (WHERE ra.artist_id IS NOT NULL) AS artist_ids,
      ARRAY_AGG(DISTINCT COALESCE(ra.anv, a.name) ORDER BY COALESCE(ra.anv, a.name)) FILTER (WHERE ra.artist_id IS NOT NULL) AS artist_names,
      ARRAY_AGG(DISTINCT ra.anv ORDER BY ra.anv) FILTER (WHERE ra.anv IS NOT NULL) AS artist_anvs,
      ARRAY_AGG(DISTINCT rl.label_id ORDER BY rl.label_id) FILTER (WHERE rl.label_id IS NOT NULL) AS label_ids,
      ARRAY_AGG(DISTINCT rl.label_name ORDER BY rl.label_name) FILTER (WHERE rl.label_name IS NOT NULL) AS label_names,
      ARRAY_AGG(DISTINCT rl.catno ORDER BY rl.catno) FILTER (WHERE rl.catno IS NOT NULL) AS catnos,
      ARRAY_AGG(DISTINCT rf.name ORDER BY rf.name) FILTER (WHERE rf.name IS NOT NULL) AS format_names,
      ARRAY_AGG(DISTINCT rf.qty::text ORDER BY rf.qty::text) FILTER (WHERE rf.qty IS NOT NULL) AS format_qtys,
      ARRAY_AGG(DISTINCT rf.descriptions ORDER BY rf.descriptions) FILTER (WHERE rf.descriptions IS NOT NULL) AS format_descriptions,
      ARRAY_AGG(DISTINCT rg.genre ORDER BY rg.genre) FILTER (WHERE rg.genre IS NOT NULL) AS genres,
      ARRAY_AGG(DISTINCT rs.style ORDER BY rs.style) FILTER (WHERE rs.style IS NOT NULL) AS styles
    FROM
      release r
      LEFT JOIN release_artist ra ON r.id = ra.release_id
      LEFT JOIN artist a ON ra.artist_id = a.id
      LEFT JOIN release_label rl ON r.id = rl.release_id
      LEFT JOIN release_format rf ON r.id = rf.release_id
      LEFT JOIN release_genre rg ON r.id = rg.release_id
      LEFT JOIN release_style rs ON r.id = rs.release_id
    WHERE
      r.id = ${releaseId}
    GROUP BY
      r.id,
      r.title,
      r.released,
      r.country,
      r.notes
  `;

  // Return null if release not found
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  // Map result to DbReleaseWithTracks type
  return {
    id: row.id,
    title: row.title,
    released: row.released,
    country: row.country,
    notes: row.notes,
    artist_ids: row.artist_ids || [],
    artist_names: row.artist_names || [],
    artist_anvs: row.artist_anvs || [],
    label_ids: row.label_ids || [],
    label_names: row.label_names || [],
    catnos: row.catnos || [],
    format_names: row.format_names || [],
    format_qtys: row.format_qtys || [],
    format_descriptions: row.format_descriptions || [],
    genres: row.genres || [],
    styles: row.styles || [],
  };
}

/**
 * Get tracks for a specific release with artist credits
 *
 * @param releaseId - The release ID to fetch tracks for
 * @returns Array of tracks with position, title, duration, and artist credits
 *
 * Query features:
 * - Returns tracks in position order
 * - Aggregates track artists with role filtering
 * - Writers: role IN ('Written By', 'Written-By', 'Composer', 'Music By')
 * - Producers: role IN ('Producer', 'Produced By', 'Executive Producer')
 * - Main track artists: role IS NULL (similar to release artists)
 * - Uses COALESCE(anv, name) for artist display names
 * - Preserves exact track position format (A1, 1-1, etc.)
 */
export async function getReleaseTracks(releaseId: number) {
  // Validate input
  if (!releaseId || releaseId <= 0) {
    return [];
  }

  // Step 1: Get all tracks for this release (simple query first)
  const tracks = await sql`
    SELECT
      id AS track_id,
      position,
      title,
      duration,
      sequence
    FROM
      release_track
    WHERE
      release_id = ${releaseId}
    ORDER BY
      sequence ASC
  `;

  if (tracks.length === 0) {
    return [];
  }

  // Step 2: Get all track artists for this release
  const trackArtists = await sql`
    SELECT
      rta.track_id,
      rta.role,
      COALESCE(rta.anv, a.name) AS artist_name
    FROM
      release_track rt
      INNER JOIN release_track_artist rta ON rt.id::text = rta.track_id
      INNER JOIN artist a ON rta.artist_id = a.id
    WHERE
      rt.release_id = ${releaseId}
  `;

  // Step 3: Group artists by track and role in JavaScript
  const artistsByTrack = new Map();

  for (const ta of trackArtists as any[]) {
    if (!artistsByTrack.has(ta.track_id)) {
      artistsByTrack.set(ta.track_id, {
        main: new Set(),
        writers: new Set(),
        producers: new Set()
      });
    }

    const trackData = artistsByTrack.get(ta.track_id);

    if (ta.role === null) {
      trackData.main.add(ta.artist_name);
    } else if (
      ta.role === 'Written By' ||
      ta.role === 'Written-By' ||
      ta.role === 'Composer' ||
      ta.role === 'Music By'
    ) {
      trackData.writers.add(ta.artist_name);
    } else if (
      ta.role === 'Producer' ||
      ta.role === 'Produced By' ||
      ta.role === 'Executive Producer'
    ) {
      trackData.producers.add(ta.artist_name);
    }
  }

  // Step 4: Combine track info with artist credits
  return tracks.map((track: any) => {
    const artists = artistsByTrack.get(track.track_id);

    return {
      position: track.position,
      title: track.title,
      duration: track.duration || '',
      artists: artists ? Array.from(artists.main).sort() : [],
      writers: artists ? Array.from(artists.writers).sort() : [],
      producers: artists ? Array.from(artists.producers).sort() : []
    };
  });
}