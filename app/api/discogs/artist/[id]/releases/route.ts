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
    
    // First deduplicate by ID (remove exact duplicates)
    const uniqueByIdReleases = allReleases.reduce((acc: any[], release: any) => {
      if (!acc.some(r => r.id === release.id)) {
        acc.push(release);
      }
      return acc;
    }, []);
    
    // Then deduplicate by title (keep only one version per album/release)
    const uniqueByTitleReleases = uniqueByIdReleases.reduce((acc: any[], release: any) => {
      const normalizedTitle = release.title?.toLowerCase().trim();
      if (!normalizedTitle) return acc;
      
      // For artist releases, just use the title as the key since they're all by the same artist
      const existing = acc.find(r => r.title?.toLowerCase().trim() === normalizedTitle);
      
      if (!existing) {
        acc.push({
          ...release,
          // Add metadata about available formats for this title
          formatVariants: uniqueByIdReleases
            .filter(r => r.title?.toLowerCase().trim() === normalizedTitle)
            .map(r => ({ id: r.id, format: r.format, year: r.year }))
        });
      }
      
      return acc;
    }, []);
    
    console.log(`Artist ${id} - Total releases: ${allReleases.length}, unique by ID: ${uniqueByIdReleases.length}, unique by title: ${uniqueByTitleReleases.length}`);
    
    return NextResponse.json({
      releases: uniqueByTitleReleases,
      pagination: {
        items: uniqueByTitleReleases.length,
        page: 1,
        pages: 1,
        per_page: uniqueByTitleReleases.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}