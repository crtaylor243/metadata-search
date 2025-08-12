'use client';

import { useSelectionStore } from '@/stores/selection-store';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export function ExportStatus() {
  const { selectedReleases, selectedArtist, selectedLabel } = useSelectionStore();
  const queryClient = useQueryClient();

  if (selectedReleases.length === 0) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        No Data Selected
      </Badge>
    );
  }

  // Check if any release track queries are still loading
  let loadingQueries = 0;
  let totalQueries = 0;
  let failedQueries = 0;

  selectedReleases.forEach(release => {
    totalQueries++;
    const queryState = queryClient.getQueryState(['release', release.id]);
    if (queryState) {
      if (queryState.status === 'pending') {
        loadingQueries++;
      } else if (queryState.status === 'error') {
        failedQueries++;
      }
    } else {
      // Query hasn't been initiated yet, count as loading
      loadingQueries++;
    }
  });

  // Also check main releases query
  if (selectedArtist) {
    const releasesQueryState = queryClient.getQueryState(['releases', selectedArtist.id]);
    if (releasesQueryState?.status === 'pending') {
      loadingQueries++;
      totalQueries++;
    } else if (releasesQueryState?.status === 'error') {
      failedQueries++;
      totalQueries++;
    }
  }

  if (selectedLabel) {
    const labelReleasesQueryState = queryClient.getQueryState(['label-releases', selectedLabel.id]);
    if (labelReleasesQueryState?.status === 'pending') {
      loadingQueries++;
      totalQueries++;
    } else if (labelReleasesQueryState?.status === 'error') {
      failedQueries++;
      totalQueries++;
    }
  }

  if (loadingQueries > 0) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Data Loading ({totalQueries - loadingQueries}/{totalQueries})
      </Badge>
    );
  }

  if (failedQueries > 0) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {failedQueries} Failed - Retrying
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200">
      <CheckCircle2 className="w-3 h-3" />
      Ready for Export
    </Badge>
  );
}