import { sql } from '@/lib/db';
import { DbArtist, DbArtistRelease } from '@/lib/types';

/**
 * Search for artists using fuzzy text matching with pg_trgm
 *
 * @param query - Search term to match against artist names and name variations
 * @returns Array of matching artists with release counts, sorted by relevance
 *
 * Query features:
 * - Uses pg_trgm extension for fuzzy matching with similarity() function
 * - Searches both artist.name and artist_namevariation.name
 * - Combines ILIKE for broad matching with similarity scoring for ranking
 * - Counts releases per artist via LEFT JOIN with release_artist
 * - Orders by: exact match first, then similarity score, then release count
 * - Returns all results (configurable via QUERY_LIMIT env var, default: no limit)
 *
 * Environment variables:
 * - QUERY_LIMIT: Maximum number of results to return (0 = no limit, default: 0)
 */
export async function searchArtists(query: string): Promise<DbArtist[]> {
  // Validate input
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = query.trim();

  const rows = await sql`
    SELECT
      a.id,
      a.name,
      a.realname,
      a.profile,
      a.data_quality,
      COUNT(DISTINCT ra.release_id)::integer AS release_count,
      similarity(a.name, ${searchTerm}) AS similarity_score
    FROM
      artist a
      LEFT JOIN artist_namevariation av ON a.id = av.artist_id
      LEFT JOIN release_artist ra ON a.id = ra.artist_id
    WHERE
      a.name ILIKE '%' || ${searchTerm} || '%'
      OR av.name ILIKE '%' || ${searchTerm} || '%'
      OR similarity(a.name, ${searchTerm}) > 0.3
    GROUP BY
      a.id,
      a.name,
      a.realname,
      a.profile,
      a.data_quality
    ORDER BY
      CASE WHEN LOWER(a.name) = LOWER(${searchTerm}) THEN 0 ELSE 1 END,
      similarity(a.name, ${searchTerm}) DESC,
      COUNT(DISTINCT ra.release_id) DESC,
      a.name ASC
  `;

  // Map results to DbArtist type
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    realname: row.realname,
    profile: row.profile,
    data_quality: row.data_quality,
    release_count: row.release_count,
  }));
}

/**
 * Get all releases for a specific artist with format variants, label information, and track details
 *
 * @param artistId - The artist ID to fetch releases for
 * @param page - Optional page number for pagination (1-based)
 * @param perPage - Optional number of results per page (default: 100)
 * @returns Array of releases with aggregated format, label, and track data
 *
 * Query features:
 * - Returns ONE ROW per release (formats and tracks aggregated)
 * - Includes master_id for accurate grouping of pressings/versions
 * - Aggregates format names into arrays (e.g., ["Vinyl", "CD", "Digital"])
 * - Aggregates label data into arrays (names, catalog numbers)
 * - **Includes full track listing with credits** (writers, producers)
 * - Sorted by release date (chronological), then title
 * - Uses master_id-based deduplication in app layer (NOT title-based)
 * - LEFT JOIN for formats and labels (some releases may not have this data)
 * - **Filters to main artist credits only** (ra.extra = 0)
 *   - Excludes track-level credits (remixers, featured artists)
 *   - Excludes extra artists (producers, engineers, etc.)
 *   - Matches Discogs website behavior for artist discographies
 *
 * Track credits logic:
 * - Main artists: role IS NULL in release_track_artist
 * - Writers: role IN ('Written By', 'Written-By', 'Composer', 'Music By')
 * - Producers: role IN ('Producer', 'Produced By', 'Executive Producer')
 *
 * Note: The app layer is responsible for:
 * - Master-based deduplication (all pressings with same master_id are same album)
 * - Final sorting by release date
 */
export async function getArtistReleases(
  artistId: number,
  page?: number,
  perPage: number = 100
): Promise<DbArtistRelease[]> {
  // Validate input
  if (!artistId || artistId <= 0) {
    return [];
  }

  // Calculate pagination offset
  const offset = page && page > 0 ? (page - 1) * perPage : 0;
  const limit = perPage;

  const rows = await sql`
    SELECT
      r.id AS release_id,
      r.title AS release_title,
      r.released,
      r.country,
      r.master_id,
      ARRAY_AGG(DISTINCT rf.name ORDER BY rf.name) FILTER (WHERE rf.name IS NOT NULL) AS format_names,
      ARRAY_AGG(DISTINCT rl.label_name ORDER BY rl.label_name) FILTER (WHERE rl.label_name IS NOT NULL) AS label_names,
      ARRAY_AGG(DISTINCT rl.catno ORDER BY rl.catno) FILTER (WHERE rl.catno IS NOT NULL) AS catnos
    FROM
      release r
      INNER JOIN release_artist ra ON r.id = ra.release_id
      LEFT JOIN release_label rl ON r.id = rl.release_id
      LEFT JOIN release_format rf ON r.id = rf.release_id
    WHERE
      ra.artist_id = ${artistId}
      AND ra.extra = 0
    GROUP BY
      r.id,
      r.title,
      r.released,
      r.country,
      r.master_id
    ORDER BY
      r.released ASC NULLS LAST,
      r.title ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Map results to DbArtistRelease type
  return rows.map((row: any) => ({
    release_id: row.release_id,
    release_title: row.release_title,
    released: row.released,
    country: row.country,
    master_id: row.master_id,
    format_names: row.format_names || [],
    label_names: row.label_names || [],
    catnos: row.catnos || [],
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
