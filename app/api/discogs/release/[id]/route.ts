import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = `https://api.discogs.com/releases/${params.id}`;
  
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
    
    // Process track credits for easier consumption
    const processedTracks = data.tracklist?.map((track: any) => ({
      position: track.position,
      title: track.title,
      duration: track.duration,
      artists: track.artists,
      extraartists: track.extraartists,
      // Extract specific credits
      writers: track.extraartists?.filter((a: any) => 
        a.role.toLowerCase().includes('written') || 
        a.role.toLowerCase().includes('composer')
      ).map((a: any) => a.name),
      producers: track.extraartists?.filter((a: any) => 
        a.role.toLowerCase().includes('producer')
      ).map((a: any) => a.name),
      performers: track.artists?.map((a: any) => a.name) || [data.artists?.[0]?.name]
    }));
    
    return NextResponse.json({
      ...data,
      processedTracks
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}