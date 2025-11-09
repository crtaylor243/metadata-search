import { NextRequest, NextResponse } from 'next/server';
import { getLabelReleases, getTracksForReleases } from '@/lib/db/queries/labels';

/**
 * Label Releases Endpoint - uses database for fast, rate-limit-free access
 *
 * Strategy: Hybrid approach
 * - Search: Use Discogs API (search endpoint) - gets proper relevancy ranking
 * - Releases: Use database (this endpoint) - fast, no rate limits
 *
 * This endpoint implements the Shadow Catalog Number algorithm for proper
 * sorting and deduplication of format variants (Vinyl, CD, Digital, etc.)
 *
 * Performance optimization (3-stage process):
 * 1. Load releases without tracks from database
 * 2. Deduplicate releases in app layer
 * 3. Load tracks in ONE query for only the deduplicated releases
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const labelId = parseInt(id, 10);

  if (isNaN(labelId) || labelId <= 0) {
    return NextResponse.json({ error: 'Invalid label ID' }, { status: 400 });
  }

  try {
    // STAGE 1: Load releases (without tracks) from database
    console.log(`Label ${id} - Fetching releases from database...`);
    const dbReleases = await getLabelReleases(labelId, undefined, 10000);
    console.log(`Label ${id} - Retrieved ${dbReleases.length} releases from database (before deduplication)`);

    // Debug: Count unique release IDs
    const uniqueReleaseIds = new Set(dbReleases.map(r => r.release_id));
    console.log(`Label ${id} - Unique release IDs: ${uniqueReleaseIds.size}`);

    // STAGE 2: Deduplicate releases in app layer
    // Transform database results to API format
    // Database returns one row per format variant, we need to consolidate
    const allReleases = dbReleases.map(row => {
      // Extract year from date string
      // The database stores dates but we need just the year part
      let year = null;
      if (row.released) {
        // Parse as UTC to avoid timezone shifts
        const date = new Date(row.released + 'T00:00:00Z');
        year = date.getUTCFullYear();
      }

      // Build format string: combine format_name with descriptions, apply shorthands
      let format = '';
      if (row.format_name) {
        format = row.format_name;
      }
      if (row.format_descriptions) {
        // Apply shorthand replacements
        let descriptions = row.format_descriptions
          .replace(/Test Pressing/g, 'TP')
          .replace(/Reissue/g, 'RE')
          .replace(/Repress/g, 'RP');

        format = format ? `${format}, ${descriptions}` : descriptions;
      }

      // Handle artist display name
      // If artist ID 194 (Various) is present, show "Various" instead of all artists
      let artist = 'Unknown Artist';
      if (row.artist_ids && row.artist_ids.includes(194)) {
        artist = 'Various';
      } else if (row.artist_names && row.artist_names.length > 0) {
        artist = row.artist_names.join(', ');
      }

      return {
        id: row.release_id,
        title: row.release_title,
        catno: row.catno,
        year,
        format,
        artist,
        // Include additional data for deduplication
        released: row.released,
        country: row.country,
        format_qty: row.format_qty,
        format_descriptions: row.format_descriptions,
        artist_ids: row.artist_ids,
        artist_names: row.artist_names,
        artist_anvs: row.artist_anvs,
        label_id: row.label_id,
        label_name: row.label_name
      };
    });

    // First deduplicate by ID to prevent React key conflicts
    const uniqueByIdReleases = allReleases.reduce((acc: any[], release: any) => {
      if (!acc.some(r => r.id === release.id)) {
        acc.push(release);
      }
      return acc;
    }, []);


    // Calculate Shadow Catalog Number for sorting (moved up to use in deduplication)
    const calculateShadowCatalogNumber = (catno: string): string => {
      if (!catno) return 'ZZZZZZZZZZZZZZZ'; // Put empty catalog numbers at the end

      // If catalog number contains comma, use only the first one
      let shadow = catno.includes(',') ? catno.split(',')[0].trim() : catno;

      // Step 1: Transform all lowercase letters to uppercase
      shadow = shadow.toUpperCase();

      // Step 2: Add an extra 'spacer zero' or move trailing single number
      // Check for 'number dash single number' or 'number space single number' at the end
      const trailingSingleNumberMatch = shadow.match(/^(.+)[-\s](\d)$/);
      if (trailingSingleNumberMatch) {
        // Move that single number to the end instead of adding zero
        shadow = trailingSingleNumberMatch[1] + trailingSingleNumberMatch[2];
      } else {
        // Add spacer zero
        shadow = shadow + '0';
      }

      // Step 3: Strip out all characters except letters and numbers
      shadow = shadow.replace(/[^A-Z0-9]/g, '');

      // Step 4: Separate groups of numbers from groups of letters using tab characters
      // Step 5: Pad all number groups out to sixteen digits wide
      let result = '';
      let i = 0;
      while (i < shadow.length) {
        if (/\d/.test(shadow[i])) {
          // Start of a number group
          let numberGroup = '';
          while (i < shadow.length && /\d/.test(shadow[i])) {
            numberGroup += shadow[i];
            i++;
          }
          // Pad to 16 digits
          numberGroup = numberGroup.padStart(16, '0');
          result += (result ? '\t' : '') + numberGroup;
        } else {
          // Start of a letter group
          let letterGroup = '';
          while (i < shadow.length && /[A-Z]/.test(shadow[i])) {
            letterGroup += shadow[i];
            i++;
          }
          result += (result ? '\t' : '') + letterGroup;
        }
      }

      return result;
    };

    // Then deduplicate by Shadow Catalog Number ONLY
    const uniqueByShadowCatnoReleases = uniqueByIdReleases.reduce((acc: any[], release: any) => {
      const shadowCatno = calculateShadowCatalogNumber(release.catno || '');

      // Check if we already have a release with this Shadow Catalog Number
      const existing = acc.find(r => {
        const existingShadowCatno = calculateShadowCatalogNumber(r.catno || '');
        return existingShadowCatno === shadowCatno;
      });

      if (!existing) {
        // Find all releases with this same Shadow Catalog Number (from the ID-deduplicated set)
        const variants = uniqueByIdReleases.filter(r => {
          const rShadowCatno = calculateShadowCatalogNumber(r.catno || '');
          return rShadowCatno === shadowCatno;
        });

        // Prefer master release if available, otherwise first chronologically
        const selectedVariant = variants.find(v => v.type === 'master') ||
                               variants.sort((a, b) => (a.year || 9999) - (b.year || 9999))[0] ||
                               release;

        // Sort format variants by year (earliest first)
        const sortedVariants = variants
          .map(r => ({ id: r.id, format: r.format, year: r.year, catno: r.catno }))
          .sort((a, b) => (a.year || 9999) - (b.year || 9999));

        acc.push({
          ...selectedVariant,
          // Add metadata about available formats for this Shadow Catalog Number
          formatVariants: sortedVariants
        });
      }

      return acc;
    }, []);



    // Sort releases by Shadow Catalog Number
    const sortByShadowCatalogNumber = (a: any, b: any) => {
      const shadowA = calculateShadowCatalogNumber(a.catno || '');
      const shadowB = calculateShadowCatalogNumber(b.catno || '');

      return shadowA.localeCompare(shadowB);
    };

    // Sort releases by Shadow Catalog Number
    const sortedReleases = [...uniqueByShadowCatnoReleases].sort(sortByShadowCatalogNumber);

    console.log(`Label ${id} - After deduplication: ${sortedReleases.length} unique releases`);

    // STAGE 3: Load tracks for deduplicated releases in a single query
    const releaseIds = sortedReleases.map(r => r.id);
    console.log(`Label ${id} - Fetching tracks for ${releaseIds.length} deduplicated releases...`);
    const tracksByRelease = await getTracksForReleases(releaseIds);
    console.log(`Label ${id} - Loaded tracks for ${tracksByRelease.size} releases`);

    // Attach tracks to releases
    const releasesWithTracks = sortedReleases.map(release => ({
      ...release,
      tracks: tracksByRelease.get(release.id) || []
    }));

    console.log(`Label ${id} - Final result: ${releasesWithTracks.length} releases with tracks`);

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
    console.error(`Label ${id} - Database error:`, error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}