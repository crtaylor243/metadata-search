'use client';

import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { exportToSpreadsheet } from '@/lib/export-utils';
import { ExportStatus } from '@/components/export-status';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rateLimiter } from '@/lib/discogs-rate-limiter';

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { selectedArtist, selectedLabel, selectedReleases, trackDetails, toggleRelease } = useSelectionStore();
  const queryClient = useQueryClient();
  
  // Use reactive queries to ensure component updates when data changes
  const { data: artistData } = useQuery({
    queryKey: ['releases', selectedArtist?.id],
    queryFn: () => null, // Won't be called since data should already be in cache
    enabled: false // Don't fetch, just watch for cache changes
  });
  
  const { data: labelData } = useQuery({
    queryKey: ['label-releases', selectedLabel?.id], 
    queryFn: () => null, // Won't be called since data should already be in cache
    enabled: false // Don't fetch, just watch for cache changes
  });

  const artistReleases = artistData?.releases || [];
  const labelReleases = labelData?.releases || [];
  
  // For artist releases, filter to main releases only
  // For label releases, use all releases since they're already filtered by the label
  const allAvailableReleases = selectedArtist 
    ? artistReleases.filter((r: any) => r.type === 'master' || r.role === 'Main')
    : labelReleases;
    
  // Check if data is loaded and available
  const isDataLoaded = selectedArtist ? !!artistData : !!labelData;
  const hasAvailableReleases = allAvailableReleases.length > 0;
  
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
            // Filter out releases that don't have valid IDs and deduplicate
            const validReleases = allAvailableReleases.filter((release: any) => release && release.id);
            const uniqueReleases = validReleases.reduce((acc: any[], release: any) => {
              if (!acc.some(r => r.id === release.id)) {
                acc.push(release);
              }
              return acc;
            }, []);
            
            uniqueReleases.forEach((release: any) => {
              const isSelected = selectedReleases.some(r => r.id === release.id);
              if (!isSelected) {
                toggleRelease(release);
              }
            });
          }}
          disabled={!isDataLoaded || !hasAvailableReleases || (hasAvailableReleases && selectedReleases.length === allAvailableReleases.length)}
          className="flex-1"
        >
          Select All ({allAvailableReleases.length})
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