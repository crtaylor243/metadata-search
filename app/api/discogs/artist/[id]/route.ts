import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRateLimit } from '@/lib/discogs-rate-limiter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `https://api.discogs.com/artists/${id}`;
  
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
    
    
    // Extract the best available image
    const profileImage = data.images?.find((img: any) => 
      img.type === 'primary' || img.type === 'secondary'
    ) || data.images?.[0];
    
    return NextResponse.json({
      id: data.id,
      name: data.name,
      realname: data.realname,
      profile: data.profile,
      urls: data.urls,
      images: data.images,
      profileImage: profileImage ? {
        uri: profileImage.uri,
        uri150: profileImage.uri150,
        width: profileImage.width,
        height: profileImage.height,
        type: profileImage.type
      } : null
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}