import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Fetch all releases by paginating through all pages
    let allReleases: any[] = [];
    let page = 1;
    let totalPages = 1;
    const perPage = 100; // Maximum allowed by Discogs
    
    do {
      const url = `https://api.discogs.com/artists/${id}/releases?per_page=${perPage}&sort=year&page=${page}`;
      
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
      allReleases = allReleases.concat(data.releases || []);
      
      // Update pagination info from first request
      if (page === 1) {
        totalPages = data.pagination?.pages || 1;
      }
      
      page++;
    } while (page <= totalPages);
    
    return NextResponse.json({
      releases: allReleases,
      pagination: {
        items: allReleases.length,
        page: 1,
        pages: 1,
        per_page: allReleases.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}