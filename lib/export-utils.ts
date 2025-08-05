import * as XLSX from 'xlsx';

export function exportToSpreadsheet(data: {
  artist: any;
  releases: any[];
  trackDetails: Map<string, any>;
}) {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Album Summary
  const albumData = data.releases.map(release => ({
    'Artist': data.artist.title,
    'Album': release.title,
    'Year': release.year || 'Unknown',
    'Label': release.label || 'Unknown',
    'Format': release.format || 'Unknown',
    'Country': release.country || 'Unknown',
    'Catalog Number': release.catno || 'N/A',
    'Release ID': release.id
  }));
  
  const ws1 = XLSX.utils.json_to_sheet(albumData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Albums');
  
  // Sheet 2: Track Details with Credits
  const trackData: any[] = [];
  data.releases.forEach(release => {
    const details = data.trackDetails.get(release.id);
    if (details?.processedTracks) {
      details.processedTracks.forEach((track: any) => {
        trackData.push({
          'Album': release.title,
          'Track #': track.position,
          'Track Title': track.title,
          'Duration': track.duration || '',
          'Writers': Array.isArray(track.writers) ? track.writers.join('; ') : '',
          'Producers': Array.isArray(track.producers) ? track.producers.join('; ') : '',
          'Performers': Array.isArray(track.performers) ? track.performers.join('; ') : data.artist.title,
          'Release ID': release.id
        });
      });
    }
  });
  
  const ws2 = XLSX.utils.json_to_sheet(trackData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Track Details');
  
  // Sheet 3: Export Metadata
  const metadata = [{
    'Export Date': new Date().toISOString(),
    'Artist': data.artist.title,
    'Artist ID': data.artist.id,
    'Total Albums': data.releases.length,
    'Total Tracks': trackData.length,
    'Data Source': 'Discogs API',
    'Application': 'Music Metadata Extractor v1.0'
  }];
  
  const ws3 = XLSX.utils.json_to_sheet(metadata);
  XLSX.utils.book_append_sheet(wb, ws3, 'Export Info');
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${data.artist.title.replace(/[^a-z0-9]/gi, '_')}_metadata_${timestamp}.xlsx`;
  
  // Write file
  XLSX.writeFile(wb, filename);
}