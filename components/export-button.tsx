'use client';

import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { exportToExcel } from '@/lib/export-utils';
import { useState } from 'react';

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { selectedArtist, selectedReleases, trackDetails } = useSelectionStore();
  
  const canExport = selectedArtist && selectedReleases.length > 0;
  const tracksLoaded = selectedReleases.every(r => trackDetails.has(r.id));
  
  const handleExport = async () => {
    if (!canExport || !tracksLoaded) return;
    
    setIsExporting(true);
    try {
      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      exportToExcel({
        artist: selectedArtist,
        releases: selectedReleases,
        trackDetails
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button
      onClick={handleExport}
      disabled={!canExport || !tracksLoaded || isExporting}
      size="lg"
      className="w-full"
    >
      {isExporting ? (
        <>
          <FileSpreadsheet className="w-4 h-4 mr-2 animate-pulse" />
          Generating Excel...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Export to Excel ({selectedReleases.length} albums)
        </>
      )}
    </Button>
  );
}