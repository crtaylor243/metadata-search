'use client';

import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { exportToExcel } from '@/lib/export-utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { selectedArtist, selectedReleases, trackDetails, toggleRelease } = useSelectionStore();
  
  // Get releases data to enable select all/clear all functionality
  const { data } = useQuery({
    queryKey: ['releases', selectedArtist?.id],
    queryFn: async () => {
      if (!selectedArtist?.id) return null;
      const res = await fetch(`/api/discogs/artist/${selectedArtist.id}/releases`);
      if (!res.ok) throw new Error('Failed to fetch releases');
      return res.json();
    },
    enabled: !!selectedArtist?.id
  });

  const releases = data?.releases || [];
  const mainReleases = releases.filter((r: any) => 
    r.type === 'master' || r.role === 'Main'
  );
  
  const canExport = selectedArtist && selectedReleases.length > 0;
  
  const handleExport = async () => {
    if (!canExport) return;
    
    setIsExporting(true);
    try {
      // Fetch track details for releases that don't have them loaded yet
      const trackDetailsMap = new Map(trackDetails);
      
      for (const release of selectedReleases) {
        if (!trackDetailsMap.has(release.id)) {
          try {
            const res = await fetch(`/api/discogs/release/${release.id}`);
            if (res.ok) {
              const trackData = await res.json();
              trackDetailsMap.set(release.id, trackData);
            }
          } catch (error) {
            console.warn(`Failed to fetch tracks for ${release.title}:`, error);
          }
        }
      }
      
      exportToExcel({
        artist: selectedArtist,
        releases: selectedReleases,
        trackDetails: trackDetailsMap
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  if (!selectedArtist) return null;

  return (
    <div className="space-y-4">
      {/* Release Selection Count */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {selectedReleases.length} releases selected for export
        </p>
      </div>

      {/* Selection Control Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            mainReleases.forEach((release: any) => {
              const isSelected = selectedReleases.some(r => r.id === release.id);
              if (!isSelected) {
                toggleRelease(release);
              }
            });
          }}
          disabled={selectedReleases.length === mainReleases.length}
          className="flex-1"
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            selectedReleases.forEach((release: any) => {
              if (mainReleases.some(r => r.id === release.id)) {
                toggleRelease(release);
              }
            });
          }}
          disabled={selectedReleases.length === 0}
          className="flex-1"
        >
          Clear All
        </Button>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={!canExport || isExporting}
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
    </div>
  );
}