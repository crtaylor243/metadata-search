import { NextRequest, NextResponse } from 'next/server';
import { getArtistReleases, getTracksForReleases } from '@/lib/db/queries/artists';

/**
 * Artist Releases Endpoint - uses database for fast, rate-limit-free access
 *
 * Strategy: Hybrid approach
 * - Search: Use Discogs API (search endpoint) - gets proper relevancy ranking
 * - Releases: Use database (this endpoint) - fast, no rate limits
 *
 * This endpoint implements master_id-based deduplication for format variants.
 * All pressings/versions with the same master_id are considered the same album.
 * This is more accurate than title-based deduplication and matches Discogs grouping.
 *
 * Special case: master_id = 0 means no master entry exists in Discogs.
 * For these releases, we fall back to title-based deduplication.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artistId = parseInt(id, 10);

  if (isNaN(artistId) || artistId <= 0) {
    return NextResponse.json({ error: 'Invalid artist ID' }, { status: 400 });
  }

  try {
    // STAGE 1: Load releases (without tracks) from database
    console.log(`Artist ${id} - Fetching releases from database...`);
    const dbReleases = await getArtistReleases(artistId, undefined, 10000);
    console.log(`Artist ${id} - Retrieved ${dbReleases.length} releases from database (before deduplication)`);

    // STAGE 2: Deduplicate releases in app layer
    // Transform database results to API format
    const allReleases = dbReleases.map(row => {
      // Extract year from date string
      let year = null;
      if (row.released) {
        // Parse as UTC to avoid timezone shifts
        const date = new Date(row.released + 'T00:00:00Z');
        year = date.getUTCFullYear();
      }

      // Build format string from array
      let format = 'Unknown';
      if (row.format_names && row.format_names.length > 0) {
        format = row.format_names.join(', ');
      }

      // Build label string from array
      let label = 'Unknown';
      if (row.label_names && row.label_names.length > 0) {
        label = row.label_names.join(', ');
      }

      return {
        id: row.release_id,
        title: row.release_title,
        year,
        format,
        label,
        master_id: row.master_id,
        // Include arrays for detailed display
        format_names: row.format_names,
        label_names: row.label_names,
        catnos: row.catnos,
        // Include additional data for sorting
        released: row.released,
        country: row.country
      };
    });

    // Deduplicate by master_id (all pressings/versions with same master_id = same album)
    // Special case: master_id = 0 means no master entry exists, fall back to title-based deduplication
    const uniqueByMasterReleases = allReleases.reduce((acc: any[], release: any) => {
      // Special case: master_id = 0 means no master exists, use title-based deduplication
      if (release.master_id === 0) {
        const normalizedTitle = release.title?.toLowerCase().trim();
        if (!normalizedTitle) return acc;

        // Check if we already have a release with this title (and master_id = 0)
        const existing = acc.find(r =>
          r.master_id === 0 && r.title?.toLowerCase().trim() === normalizedTitle
        );

        if (!existing) {
          // Find all releases with this same title and master_id = 0
          const variants = allReleases.filter(r =>
            r.master_id === 0 && r.title?.toLowerCase().trim() === normalizedTitle
          );

          // Prefer first chronologically
          const selectedVariant = variants.sort((a, b) =>
            (a.year || 9999) - (b.year || 9999)
          )[0] || release;

          acc.push(selectedVariant);
        }

        return acc;
      }

      // Normal case: use master_id for deduplication
      const existing = acc.find(r => r.master_id === release.master_id);

      if (!existing) {
        // Find all releases with this same master_id
        const variants = allReleases.filter(r => r.master_id === release.master_id);

        // Prefer first chronologically (earliest release)
        const selectedVariant = variants.sort((a, b) =>
          (a.year || 9999) - (b.year || 9999)
        )[0] || release;

        acc.push(selectedVariant);
      }

      return acc;
    }, []);

    console.log(`Artist ${id} - After deduplication: ${uniqueByMasterReleases.length} unique releases`);

    // STAGE 3: Load tracks for deduplicated releases in a single query
    const releaseIds = uniqueByMasterReleases.map(r => r.id);
    console.log(`Artist ${id} - Fetching tracks for ${releaseIds.length} deduplicated releases...`);
    const tracksByRelease = await getTracksForReleases(releaseIds);
    console.log(`Artist ${id} - Loaded tracks for ${tracksByRelease.size} releases`);

    // Attach tracks to releases
    const releasesWithTracks = uniqueByMasterReleases.map(release => ({
      ...release,
      tracks: tracksByRelease.get(release.id) || []
    }));

    return NextResponse.json({
      releases: releasesWithTracks,
      pagination: {
        items: releasesWithTracks.length,
        page: 1,
        pages: 1,
        per_page: releasesWithTracks.length
      }
    });
  } catch (error) {
    console.error(`Artist ${id} - Database error:`, error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}