import * as XLSX from 'xlsx';

export function exportToSpreadsheet(data: {
  artist?: any;
  label?: any;
  releases: any[];
  trackDetails: Map<string, any>;
}) {
  const wb = XLSX.utils.book_new();
  
  // Create single sheet in "Contract Schedule" format
  const contractData: any[] = [];
  
  // Releases are already sorted by catalog number from the API
  data.releases.forEach(release => {
    const details = data.trackDetails.get(release.id);
    if (details?.processedTracks) {
      details.processedTracks.forEach((track: any) => {
        // Use album name without format brackets
        const albumWithFormat = release.title;
        
        // Get writers (Control column) - comma-separated
        const writers = Array.isArray(track.writers) && track.writers.length > 0
          ? track.writers.join(', ')
          : '';
        
        // Use artist name from release details - this is the definitive source
        const artistName = details.artists?.[0]?.name;
        
        contractData.push({
          'Artist': artistName,
          'Album': albumWithFormat,
          'Recording Title': track.title,
          'Control': writers
        });
      });
    }
  });
  
  // Create worksheet with contract schedule format
  const ws = XLSX.utils.json_to_sheet(contractData);
  XLSX.utils.book_append_sheet(wb, ws, 'Contract Schedule');
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const entityName = data.artist?.title || data.label?.title || 'unknown';
  const filename = `${entityName.replace(/[^a-z0-9]/gi, '_')}_contract_schedule_${timestamp}.xlsx`;
  
  // Write file
  XLSX.writeFile(wb, filename);
}