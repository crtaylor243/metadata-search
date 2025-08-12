import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `https://api.discogs.com/releases/${id}`;
  
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

    // Process label information for better display
    const processedLabels = data.labels?.map((label: any) => ({
      name: label.name,
      catno: label.catno,
      entity_type: label.entity_type
    })) || [];

    // Process format information for better display
    const processedFormats = data.formats?.map((format: any) => ({
      name: format.name,
      qty: format.qty,
      descriptions: format.descriptions || []
    })) || [];

    // Create a clean display format string
    const formatDisplay = processedFormats.length > 0 
      ? processedFormats.map(f => {
          const parts = [f.name];
          if (f.descriptions?.length > 0) {
            parts.push(...f.descriptions); // Include all descriptions
          }
          return parts.join(', ');
        }).join(' + ')
      : 'Unknown';

    // Create a clean label display string
    const labelDisplay = processedLabels.length > 0
      ? processedLabels.map(l => {
          const parts = [l.name];
          if (l.catno) parts.push(`(${l.catno})`);
          return parts.join(' ');
        }).join(', ')
      : 'Unknown';
    
    return NextResponse.json({
      ...data,
      processedTracks,
      processedLabels,
      processedFormats,
      // Convenience fields for display
      displayFormat: formatDisplay,
      displayLabel: labelDisplay,
      displayYear: data.year || data.released?.split('-')[0] || 'Unknown'
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}