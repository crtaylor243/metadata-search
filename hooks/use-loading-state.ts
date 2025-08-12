import { useSelectionStore } from '@/stores/selection-store';
import { useQuery } from '@tanstack/react-query';

export function useLoadingState() {
  const { selectedArtist, selectedLabel, selectedReleases } = useSelectionStore();
  
  // Check if we're loading artist releases
  const { isLoading: isLoadingArtistReleases } = useQuery({
    queryKey: ['releases', selectedArtist?.id],
    enabled: false // Just to check status, not actually trigger
  });

  // Check if we're loading label releases
  const { isLoading: isLoadingLabelReleases } = useQuery({
    queryKey: ['label-releases', selectedLabel?.id],
    enabled: false // Just to check status, not actually trigger
  });

  // For track details, we need to check if any release track queries are loading
  const hasLoadingTrackQueries = selectedReleases.some(release => {
    // This will check the cache for each release's track query status
    const { isLoading } = useQuery({
      queryKey: ['release', release.id],
      enabled: false // Just checking status
    });
    return isLoading;
  });

  const isAnyLoading = isLoadingArtistReleases || isLoadingLabelReleases || hasLoadingTrackQueries;
  const hasSelectedData = selectedReleases.length > 0;
  
  return {
    isLoading: isAnyLoading,
    hasData: hasSelectedData,
    status: !hasSelectedData ? 'no-data' : isAnyLoading ? 'loading' : 'ready'
  };
}