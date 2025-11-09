import { NextRequest, NextResponse } from 'next/server';
import { getReleaseDetails, getReleaseTracks } from '@/lib/db/queries/releases';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

/**
 * Release Details Endpoint - uses database for all data
 *
 * Strategy:
 * - Metadata: Use database (fast, no rate limits)
 * - Tracks: Use database (includes credits via getReleaseTracks)
 * - Images: Skipped by default (not in database)
 *   - Can be loaded on-demand via ?loadImages=true query parameter
 *   - This saves rate limits and speeds up initial page loads
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const releaseId = parseInt(id, 10);

  if (isNaN(releaseId) || releaseId <= 0) {
    return NextResponse.json({ error: 'Invalid release ID' }, { status: 400 });
  }

  // Check if images should be loaded (opt-in via query parameter)
  const { searchParams } = new URL(request.url);
  const loadImages = searchParams.get('loadImages') === 'true';

  try {
    console.log(`Release ${id} - Fetching from database...`);

    // Fetch release metadata from database
    const dbRelease = await getReleaseDetails(releaseId);

    if (!dbRelease) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    console.log(`Release ${id} - Found in database, fetching tracks from database...`);

    // Fetch track details from database
    const dbTracks = await getReleaseTracks(releaseId);

    console.log(`Release ${id} - Found ${dbTracks.length} tracks in database`);

    // Fetch images from Discogs API only if explicitly requested
    let discogsData: any = { images: [], thumb: null };

    if (loadImages) {
      console.log(`Release ${id} - Loading images from Discogs API...`);
      const url = `https://api.discogs.com/releases/${id}`;
      const response = await fetchWithRateLimit(url, {
        headers: {
          'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
          'User-Agent': 'MusicMetadataApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Discogs API error: ${response.status}`);
      }

      discogsData = await response.json();
      console.log(`Release ${id} - Loaded ${discogsData.images?.length || 0} images`);
    }

    // Process database tracks into expected format
    const processedTracks = dbTracks.map((track: any) => ({
      position: track.position,
      title: track.title,
      duration: track.duration,
      artists: track.artists || [],
      writers: track.writers || [],
      producers: track.producers || []
    }));

    // Build tracklist format matching Discogs API structure
    const tracklist = dbTracks.map((track: any) => ({
      position: track.position,
      title: track.title,
      duration: track.duration,
      // Main track artists
      artists: track.artists?.map((name: string) => ({ name })) || [],
      // Extra artists (writers and producers)
      extraartists: [
        ...(track.writers?.map((name: string) => ({ name, role: 'Written By' })) || []),
        ...(track.producers?.map((name: string) => ({ name, role: 'Producer' })) || [])
      ]
    }));

    // Process label information for better display (from database)
    const processedLabels = dbRelease.label_names.map((name, index) => ({
      name,
      catno: dbRelease.catnos[index] || null,
      entity_type: 'Label'
    }));

    // Process format information for better display (from database)
    const processedFormats = dbRelease.format_names.map((name, index) => ({
      name,
      qty: dbRelease.format_qtys[index] ? parseInt(dbRelease.format_qtys[index]) : 1,
      descriptions: dbRelease.format_descriptions[index]?.split(', ') || []
    }));

    // Create a clean display format string
    const formatDisplay = processedFormats.length > 0
      ? processedFormats.map(f => {
          const parts = [f.name];
          if (f.descriptions?.length > 0) {
            parts.push(...f.descriptions);
          }
          return parts.join(', ');
        }).join(' + ')
      : 'Unknown';

    // Create a clean label display string
    const labelDisplay = processedLabels.length > 0
      ? processedLabels.map(l => {
          const parts = [l.name];
          if (l.catno) parts.push(`(${l.catno})`);
          return parts.join(' ');
        }).join(', ')
      : 'Unknown';

    // Extract year from database date
    let year = null;
    if (dbRelease.released) {
      const date = new Date(dbRelease.released + 'T00:00:00Z');
      year = date.getUTCFullYear();
    }

    // Build response matching Discogs API format
    return NextResponse.json({
      id: dbRelease.id,
      title: dbRelease.title,
      released: dbRelease.released,
      country: dbRelease.country,
      notes: dbRelease.notes,
      year,
      // Artists from database (with ANV handling)
      artists: dbRelease.artist_names.map((name, index) => ({
        name,
        id: dbRelease.artist_ids[index],
        anv: dbRelease.artist_anvs[index] || null
      })),
      // Labels from database
      labels: processedLabels,
      // Formats from database
      formats: processedFormats,
      // Genres and styles from database
      genres: dbRelease.genres,
      styles: dbRelease.styles,
      // Tracks from database (includes credits)
      tracklist,
      processedTracks,
      processedLabels,
      processedFormats,
      // Convenience fields for display
      displayFormat: formatDisplay,
      displayLabel: labelDisplay,
      displayYear: year || 'Unknown',
      // Images from Discogs API
      images: discogsData.images || [],
      thumb: discogsData.thumb || null
    });
  } catch (error) {
    console.error(`Release ${id} - Error:`, error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}