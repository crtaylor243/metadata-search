import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

/**
 * Artist Details Endpoint - hybrid approach
 *
 * Strategy:
 * - Artist metadata: Use database (fast, no rate limits)
 * - Images: Use Discogs API (images not in database)
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
    console.log(`Artist ${id} - Fetching from database...`);

    // Fetch artist details from database
    const rows = await sql`
      SELECT
        a.id,
        a.name,
        a.realname,
        a.profile,
        a.data_quality,
        COUNT(DISTINCT ra.release_id)::integer AS release_count
      FROM
        artist a
        LEFT JOIN release_artist ra ON a.id = ra.artist_id
      WHERE
        a.id = ${artistId}
      GROUP BY
        a.id,
        a.name,
        a.realname,
        a.profile,
        a.data_quality
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const artist = rows[0];

    console.log(`Artist ${id} - Found in database, fetching images from Discogs API...`);

    // Fetch images from Discogs API (images not in database)
    const url = `https://api.discogs.com/artists/${id}`;
    const response = await fetchWithRateLimit(url, {
      headers: {
        'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
        'User-Agent': 'MusicMetadataApp/1.0'
      }
    });

    let images = [];
    let profileImage = null;

    if (response.ok) {
      const discogsData = await response.json();
      images = discogsData.images || [];

      // Extract the best available image
      profileImage = images.find((img: any) =>
        img.type === 'primary' || img.type === 'secondary'
      ) || images[0] || null;

      if (profileImage) {
        profileImage = {
          uri: profileImage.uri,
          uri150: profileImage.uri150,
          width: profileImage.width,
          height: profileImage.height,
          type: profileImage.type
        };
      }
    } else {
      console.warn(`Artist ${id} - Failed to fetch images from Discogs API: ${response.status}`);
    }

    return NextResponse.json({
      id: artist.id,
      name: artist.name,
      realname: artist.realname,
      profile: artist.profile,
      release_count: artist.release_count,
      data_quality: artist.data_quality,
      images,
      profileImage
    });
  } catch (error) {
    console.error(`Artist ${id} - Error:`, error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}