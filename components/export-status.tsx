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

  // Check main releases query status
  // Tracks are now loaded in bulk with releases, so we only need to check the main query
  let isLoading = false;
  let hasFailed = false;

  if (selectedArtist) {
    const releasesQueryState = queryClient.getQueryState(['releases', selectedArtist.id]);
    if (releasesQueryState?.status === 'pending') {
      isLoading = true;
    } else if (releasesQueryState?.status === 'error') {
      hasFailed = true;
    }
  }

  if (selectedLabel) {
    const labelReleasesQueryState = queryClient.getQueryState(['label-releases', selectedLabel.id]);
    if (labelReleasesQueryState?.status === 'pending') {
      isLoading = true;
    } else if (labelReleasesQueryState?.status === 'error') {
      hasFailed = true;
    }
  }

  if (isLoading) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border-yellow-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading Releases & Tracks...
      </Badge>
    );
  }

  if (hasFailed) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Failed to Load Data
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