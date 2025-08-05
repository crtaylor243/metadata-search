import { NextResponse } from 'next/server';

export async function GET() {
  const response = await fetch('https://api.discogs.com', {
    headers: {
      'Authorization': `Discogs token=${process.env.DISCOGS_TOKEN}`,
      'User-Agent': 'MusicMetadataApp/1.0'
    }
  });
  
  return NextResponse.json({ 
    status: response.status,
    connected: response.ok 
  });
}