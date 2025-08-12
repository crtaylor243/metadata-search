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
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    console.log(`Label ${id} - Starting to fetch releases...`);
    
    do {
      const url = `https://api.discogs.com/labels/${id}/releases?per_page=${perPage}&page=${page}`;
      
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
        const pageReleases = data.releases || [];
        allReleases = allReleases.concat(pageReleases);
        
        console.log(`Label ${id} - Page ${page}/${totalPages}: fetched ${pageReleases.length} releases, total so far: ${allReleases.length}`);
        
        // Update pagination info from first request
        if (page === 1) {
          totalPages = data.pagination?.pages || 1;
          console.log(`Label ${id} - Total pages: ${totalPages}, estimated items: ${data.pagination?.items}`);
        }
        
        // Reset consecutive error counter on success
        consecutiveErrors = 0;
        page++;
        
      } catch (error) {
        consecutiveErrors++;
        console.error(`Label ${id} - Error on page ${page}: ${error}`);
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.error(`Label ${id} - Too many consecutive errors (${consecutiveErrors}), stopping. Got ${allReleases.length} releases from ${page-1} pages.`);
          break;
        }
        
        // Skip this page and continue
        console.warn(`Label ${id} - Skipping page ${page} and continuing...`);
        page++;
      }
    } while (page <= totalPages);
    
    console.log(`Label ${id} - Final result: ${allReleases.length} total releases (before deduplication)`);
    
    // First deduplicate by ID (remove exact duplicates)
    const uniqueByIdReleases = allReleases.reduce((acc: any[], release: any) => {
      if (!acc.some(r => r.id === release.id)) {
        acc.push(release);
      }
      return acc;
    }, []);
    
    console.log(`Label ${id} - After ID deduplication: ${uniqueByIdReleases.length} releases`);
    
    // Then deduplicate by title (keep only one version per album/release)
    const uniqueByTitleReleases = uniqueByIdReleases.reduce((acc: any[], release: any) => {
      const normalizedTitle = release.title?.toLowerCase().trim();
      if (!normalizedTitle) return acc;
      
      // Check if we already have a release with this title (by same artist if available)
      const key = release.artist ? `${release.artist.toLowerCase()}-${normalizedTitle}` : normalizedTitle;
      const existing = acc.find(r => {
        const existingKey = r.artist ? `${r.artist.toLowerCase()}-${r.title?.toLowerCase().trim()}` : r.title?.toLowerCase().trim();
        return existingKey === key;
      });
      
      if (!existing) {
        // Keep the release with the most formats info (prefer master or first chronologically)
        acc.push({
          ...release,
          // Add metadata about available formats for this title
          formatVariants: uniqueByIdReleases
            .filter(r => {
              const rKey = r.artist ? `${r.artist.toLowerCase()}-${r.title?.toLowerCase().trim()}` : r.title?.toLowerCase().trim();
              return rKey === key;
            })
            .map(r => ({ id: r.id, format: r.format, year: r.year }))
        });
      }
      
      return acc;
    }, []);
    
    console.log(`Label ${id} - After title deduplication: ${uniqueByTitleReleases.length} unique releases (${uniqueByIdReleases.length - uniqueByTitleReleases.length} format variants removed)`);
    
    // Analyze release types for debugging
    const releaseAnalysis = uniqueByTitleReleases.reduce((acc: any, release: any) => {
      const status = release.status || 'unknown';
      const type = release.type || 'unknown';
      const format = release.format || 'unknown';
      
      acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      acc.byFormat[format] = (acc.byFormat[format] || 0) + 1;
      
      return acc;
    }, { byStatus: {}, byType: {}, byFormat: {} });
    
    console.log(`Label ${id} - Release analysis:`, JSON.stringify(releaseAnalysis, null, 2));
    
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