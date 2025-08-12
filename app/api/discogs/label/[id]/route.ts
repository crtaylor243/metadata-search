import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `https://api.discogs.com/labels/${id}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
        'User-Agent': 'MusicMetadataApp/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      id: data.id,
      name: data.name,
      profile: data.profile,
      contact_info: data.contact_info,
      parent_label: data.parent_label,
      sublabels: data.sublabels,
      urls: data.urls,
      images: data.images,
      releases_url: data.releases_url,
      data_quality: data.data_quality
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}