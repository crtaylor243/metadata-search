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
    
    // First deduplicate by ID to prevent React key conflicts
    const uniqueByIdReleases = allReleases.reduce((acc: any[], release: any) => {
      if (!acc.some(r => r.id === release.id)) {
        acc.push(release);
      }
      return acc;
    }, []);
    
    console.log(`Label ${id} - After ID deduplication: ${uniqueByIdReleases.length} releases`);
    
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
        
        // Debug which variant was selected
        if (variants.length > 1) {
          console.log(`Shadow Catalog Number "${shadowCatno}" (from "${release.catno}") has ${variants.length} variants, selected:`, {
            id: selectedVariant.id,
            catno: selectedVariant.catno,
            title: selectedVariant.title,
            format: selectedVariant.format,
            type: selectedVariant.type,
            year: selectedVariant.year
          }, 'from variants:', variants.map(v => ({ id: v.id, catno: v.catno, title: v.title, format: v.format })));
        }
        
        acc.push({
          ...selectedVariant,
          // Add metadata about available formats for this Shadow Catalog Number
          formatVariants: variants.map(r => ({ id: r.id, format: r.format, year: r.year, catno: r.catno }))
        });
      }
      
      return acc;
    }, []);
    
    console.log(`Label ${id} - After Shadow Catalog Number deduplication: ${uniqueByShadowCatnoReleases.length} unique releases (${uniqueByIdReleases.length - uniqueByShadowCatnoReleases.length} Shadow Catalog Number variants removed)`);
    
    // Analyze release types for debugging
    const releaseAnalysis = uniqueByShadowCatnoReleases.reduce((acc: any, release: any) => {
      const status = release.status || 'unknown';
      const type = release.type || 'unknown';
      const format = release.format || 'unknown';
      
      acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      acc.byFormat[format] = (acc.byFormat[format] || 0) + 1;
      
      return acc;
    }, { byStatus: {}, byType: {}, byFormat: {} });
    
    console.log(`Label ${id} - Release analysis:`, JSON.stringify(releaseAnalysis, null, 2));
    
    // Sort releases by Shadow Catalog Number
    const sortByShadowCatalogNumber = (a: any, b: any) => {
      const shadowA = calculateShadowCatalogNumber(a.catno || '');
      const shadowB = calculateShadowCatalogNumber(b.catno || '');
      
      return shadowA.localeCompare(shadowB);
    };
    
    // Sort releases by Shadow Catalog Number
    const sortedReleases = [...uniqueByShadowCatnoReleases].sort(sortByShadowCatalogNumber);
    
    console.log(`Label ${id} - Sample catalog numbers (sorted by Shadow Catalog Number):`, sortedReleases.slice(0, 10).map(r => ({
      id: r.id,
      title: r.title,
      catno: r.catno,
      shadowCatno: calculateShadowCatalogNumber(r.catno || ''),
      year: r.year
    })));
    
    return NextResponse.json({
      releases: sortedReleases,
      pagination: {
        items: sortedReleases.length,
        page: 1,
        pages: 1,
        per_page: sortedReleases.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}