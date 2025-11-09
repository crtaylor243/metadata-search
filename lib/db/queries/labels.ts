import { sql } from '@/lib/db';
import { DbLabel, DbLabelRelease } from '@/lib/types';

/**
 * Search for labels using fuzzy text matching with pg_trgm
 *
 * @param query - Search term to match against label names
 * @returns Array of matching labels with release counts, sorted by relevance
 *
 * Query features:
 * - Uses pg_trgm extension for fuzzy matching with similarity() function
 * - Combines ILIKE for broad matching with similarity scoring for ranking
 * - Counts releases per label via LEFT JOIN with release_label
 * - Orders by: exact match first, then similarity score, then release count
 * - Returns all results (configurable via QUERY_LIMIT env var, default: no limit)
 *
 * Environment variables:
 * - QUERY_LIMIT: Maximum number of results to return (0 = no limit, default: 0)
 */
export async function searchLabels(query: string): Promise<DbLabel[]> {
  // Validate input
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.trim();

  const rows = await sql`
    SELECT
      l.id,
      l.name,
      l.contact_info,
      l.profile,
      l.parent_id,
      l.parent_name,
      l.data_quality,
      COUNT(rl.release_id)::integer AS release_count,
      similarity(l.name, ${searchTerm}) AS similarity_score
    FROM
      label l
      LEFT JOIN release_label rl ON l.id = rl.label_id
    WHERE
      l.name ILIKE '%' || ${searchTerm} || '%'
      OR similarity(l.name, ${searchTerm}) > 0.3
    GROUP BY
      l.id,
      l.name,
      l.contact_info,
      l.profile,
      l.parent_id,
      l.parent_name,
      l.data_quality
    ORDER BY
      CASE WHEN LOWER(l.name) = LOWER(${searchTerm}) THEN 0 ELSE 1 END,
      similarity(l.name, ${searchTerm}) DESC,
      COUNT(rl.release_id) DESC,
      l.name ASC
  `;

  // Map results to DbLabel type
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    contact_info: row.contact_info,
    profile: row.profile,
    parent_id: row.parent_id,
    parent_name: row.parent_name,
    data_quality: row.data_quality,
    release_count: row.release_count,
  }));
}

/**
 * Get all releases for a specific label with format variants, artist information, and track details
 *
 * @param labelId - The label ID to fetch releases for
 * @param page - Optional page number for pagination (1-based)
 * @param perPage - Optional number of results per page (default: 100)
 * @returns Array of releases with format variants, aggregated artist data, and tracks
 *
 * Query features:
 * - Returns ONE ROW per format variant (deduplication happens in app layer)
 * - Aggregates artist data into arrays (ids, names, name variations)
 * - **Includes full track listing with credits** (writers, producers)
 * - Includes catalog number (catno) for shadow_catno calculation in app layer
 * - Sorted by catalog number (app layer re-sorts by shadow_catno)
 * - LEFT JOIN for formats (some releases may not have format data)
 * - Uses COALESCE(anv, name) for artist display names
 *
 * Track credits logic:
 * - Main artists: role IS NULL in release_track_artist
 * - Writers: role IN ('Written By', 'Written-By', 'Composer', 'Music By')
 * - Producers: role IN ('Producer', 'Produced By', 'Executive Producer')
 *
 * Note: The app layer is responsible for:
 * - Calculating shadow_catno for proper sorting/deduplication
 * - Grouping format variants into formatVariants[] array
 * - Final sorting by shadow catalog number algorithm
 */
export async function getLabelReleases(
  labelId: number,
  page?: number,
  perPage: number = 100
): Promise<DbLabelRelease[]> {
  // Validate input
  if (!labelId || labelId <= 0) {
    return [];
  }

  // Calculate pagination offset
  const offset = page && page > 0 ? (page - 1) * perPage : 0;
  const limit = perPage;

  const rows = await sql`
    SELECT
      r.id AS release_id,
      r.title AS release_title,
      rl.catno,
      r.released,
      r.country,
      rf.name AS format_name,
      rf.qty AS format_qty,
      rf.descriptions AS format_descriptions,
      ARRAY_AGG(DISTINCT ra.artist_id ORDER BY ra.artist_id) FILTER (WHERE ra.artist_id IS NOT NULL AND ra.role IS NULL) AS artist_ids,
      ARRAY_AGG(DISTINCT COALESCE(ra.anv, a.name) ORDER BY COALESCE(ra.anv, a.name)) FILTER (WHERE ra.artist_id IS NOT NULL AND ra.role IS NULL) AS artist_names,
      ARRAY_AGG(DISTINCT ra.anv ORDER BY ra.anv) FILTER (WHERE ra.anv IS NOT NULL AND ra.role IS NULL) AS artist_anvs,
      rl.label_id,
      rl.label_name
    FROM
      release r
      INNER JOIN release_label rl ON r.id = rl.release_id
      LEFT JOIN release_artist ra ON r.id = ra.release_id
      LEFT JOIN artist a ON ra.artist_id = a.id
      LEFT JOIN release_format rf ON r.id = rf.release_id
    WHERE
      rl.label_id = ${labelId}
    GROUP BY
      r.id,
      r.title,
      rl.catno,
      r.released,
      r.country,
      rf.name,
      rf.qty,
      rf.descriptions,
      rl.label_id,
      rl.label_name
    ORDER BY
      rl.catno ASC NULLS LAST,
      r.title ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Map results to DbLabelRelease type
  return rows.map((row: any) => ({
    release_id: row.release_id,
    release_title: row.release_title,
    catno: row.catno,
    released: row.released,
    country: row.country,
    format_name: row.format_name,
    format_qty: row.format_qty,
    format_descriptions: row.format_descriptions,
    artist_ids: row.artist_ids || [],
    artist_names: row.artist_names || [],
    artist_anvs: row.artist_anvs || [],
    label_id: row.label_id,
    label_name: row.label_name,
  }));
}

/**
 * Get tracks for multiple releases in a single query
 *
 * @param releaseIds - Array of release IDs to fetch tracks for
 * @returns Map of release_id to array of tracks
 */
export async function getTracksForReleases(releaseIds: number[]): Promise<Map<number, any[]>> {
  if (!releaseIds || releaseIds.length === 0) {
    return new Map();
  }

  const rows = await sql`
    SELECT
      rt.release_id,
      rt.position,
      rt.title,
      rt.duration,
      rt.sequence
    FROM
      release_track rt
    WHERE
      rt.release_id = ANY(${releaseIds})
    ORDER BY
      rt.release_id,
      rt.sequence ASC
  `;

  // Group tracks by release_id
  const tracksByRelease = new Map<number, any[]>();

  for (const row of rows as any[]) {
    if (!tracksByRelease.has(row.release_id)) {
      tracksByRelease.set(row.release_id, []);
    }

    tracksByRelease.get(row.release_id)!.push({
      position: row.position,
      title: row.title,
      duration: row.duration || '',
    });
  }

  return tracksByRelease;
}
