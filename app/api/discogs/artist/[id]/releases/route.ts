import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `https://api.discogs.com/artists/${id}/releases?per_page=100&sort=year`;
  
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
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}