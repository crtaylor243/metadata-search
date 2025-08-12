'use client';

import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { exportToSpreadsheet } from '@/lib/export-utils';
import { ExportStatus } from '@/components/export-status';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { selectedArtist, selectedLabel, selectedReleases, trackDetails, toggleRelease } = useSelectionStore();
  const queryClient = useQueryClient();
  
  // Get releases data to enable select all/clear all functionality
  const { data: artistData } = useQuery({
    queryKey: ['releases', selectedArtist?.id],
    queryFn: async () => {
      if (!selectedArtist?.id) return null;
      const res = await fetch(`/api/discogs/artist/${selectedArtist.id}/releases`);
      if (!res.ok) throw new Error('Failed to fetch releases');
      return res.json();
    },
    enabled: !!selectedArtist?.id
  });

  const { data: labelData } = useQuery({
    queryKey: ['label-releases', selectedLabel?.id],
    queryFn: async () => {
      if (!selectedLabel?.id) return null;
      const res = await fetch(`/api/discogs/label/${selectedLabel.id}/releases`);
      if (!res.ok) throw new Error('Failed to fetch label releases');
      return res.json();
    },
    enabled: !!selectedLabel?.id
  });

  const artistReleases = artistData?.releases || [];
  const labelReleases = labelData?.releases || [];
  
  // For artist releases, filter to main releases only
  // For label releases, use all releases since they're already filtered by the label
  const allAvailableReleases = selectedArtist 
    ? artistReleases.filter((r: any) => r.type === 'master' || r.role === 'Main')
    : labelReleases;
  
  const canExport = (selectedArtist || selectedLabel) && selectedReleases.length > 0;

  // Check if data is ready for export (all queries completed successfully)
  const isDataReady = () => {
    if (selectedReleases.length === 0) return false;

    // Check if any release track queries are still loading or failed
    let hasLoadingOrFailedQueries = false;
    
    selectedReleases.forEach(release => {
      const queryState = queryClient.getQueryState(['release', release.id]);
      if (!queryState || queryState.status === 'pending' || queryState.status === 'error') {
        hasLoadingOrFailedQueries = true;
      }
    });

    // Also check main releases query
    if (selectedArtist) {
      const releasesQueryState = queryClient.getQueryState(['releases', selectedArtist.id]);
      if (releasesQueryState && (releasesQueryState.status === 'pending' || releasesQueryState.status === 'error')) {
        hasLoadingOrFailedQueries = true;
      }
    }

    if (selectedLabel) {
      const labelReleasesQueryState = queryClient.getQueryState(['label-releases', selectedLabel.id]);
      if (labelReleasesQueryState && (labelReleasesQueryState.status === 'pending' || labelReleasesQueryState.status === 'error')) {
        hasLoadingOrFailedQueries = true;
      }
    }

    return !hasLoadingOrFailedQueries;
  };
  
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
      
      exportToSpreadsheet({
        artist: selectedArtist,
        label: selectedLabel,
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
  
  if (!selectedArtist && !selectedLabel) return null;

  return (
    <div className="space-y-4">
      {/* Export Status Indicator */}
      <div className="flex items-center justify-center">
        <ExportStatus />
      </div>

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
            allAvailableReleases.forEach((release: any) => {
              const isSelected = selectedReleases.some(r => r.id === release.id);
              if (!isSelected) {
                toggleRelease(release);
              }
            });
          }}
          disabled={selectedReleases.length === allAvailableReleases.length}
          className="flex-1"
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            selectedReleases.forEach((release: any) => {
              if (allAvailableReleases.some(r => r.id === release.id)) {
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
        disabled={!canExport || isExporting || !isDataReady()}
        size="lg"
        className="w-full"
      >
        {isExporting ? (
          <>
            <FileSpreadsheet className="w-4 h-4 mr-2 animate-pulse" />
            Generating spreadsheet...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export to spreadsheet ({selectedReleases.length} albums)
          </>
        )}
      </Button>
    </div>
  );
}