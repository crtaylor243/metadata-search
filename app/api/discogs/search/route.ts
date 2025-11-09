import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

/**
 * Search endpoint - uses Discogs API for search to leverage their relevancy sorting
 *
 * Strategy: Hybrid approach
 * - Search: Use Discogs API (this endpoint) - gets proper relevancy ranking
 * - Details: Use database (other endpoints) - fast, no rate limits
 *
 * The Discogs IDs in search results match database IDs, so subsequent
 * queries can use the database for releases, tracks, etc.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'artist';

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=${type}&per_page=50`;

  try {
    const response = await fetchWithRateLimit(url, {
      headers: {
        'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
        'User-Agent': 'MusicMetadataApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }

    const data = await response.json();

    // Return Discogs results directly
    // IDs in these results match database IDs, so subsequent endpoints can use the database
    return NextResponse.json(data);
  } catch (error) {
    console.error('Discogs search error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
