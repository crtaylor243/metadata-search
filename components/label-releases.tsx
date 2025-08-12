'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronRight, Eye, EyeOff, Music } from 'lucide-react';

// Individual release component with expandable tracks
function LabelReleaseItem({ 
  release, 
  isExpanded, 
  isSelected, 
  onToggleExpansion, 
  onToggleSelection,
  trackData 
}: {
  release: any;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpansion: () => void;
  onToggleSelection: () => void;
  trackData: any;
}) {

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpansion}>
      <div className="border rounded-lg">
        {/* Release Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{release.title}</h3>
                {release.year && (
                  <Badge variant="outline" className="shrink-0">
                    {release.year}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {release.artist && (
                  <span className="font-medium">{release.artist}</span>
                )}
                {release.format && (
                  <span className="bg-muted px-2 py-1 rounded text-xs">
                    {release.format}
                  </span>
                )}
                {release.catno && (
                  <span>Cat: {release.catno}</span>
                )}
              </div>
            </div>
          </div>
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="ml-2">
                {isExpanded ? 'Hide' : 'Show'} Tracks
              </span>
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Track Listing */}
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-4">
            {trackData?.isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading tracks...
              </div>
            )}
            
            {trackData?.error && (
              <p className="text-center text-destructive py-4">
                Failed to load tracks
              </p>
            )}
            
            {trackData?.data?.processedTracks && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Track Listing</h4>
                <div className="space-y-2">
                  {trackData.data.processedTracks.map((track: any) => (
                    <div key={track.position} className="text-sm">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {track.position}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{track.title}</p>
                          {track.duration && (
                            <p className="text-muted-foreground text-xs">
                              Duration: {track.duration}
                            </p>
                          )}
                          {track.writers?.length > 0 && (
                            <p className="text-muted-foreground text-xs">
                              Writers: {track.writers.join(', ')}
                            </p>
                          )}
                          {track.producers?.length > 0 && (
                            <p className="text-muted-foreground text-xs">
                              Producers: {track.producers.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function LabelReleases() {
  const { selectedLabel, selectedReleases, toggleRelease, addTrackDetails } = useSelectionStore();
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [groupedByArtist, setGroupedByArtist] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['label-releases', selectedLabel?.id],
    queryFn: async () => {
      if (!selectedLabel?.id) return null;
      const res = await fetch(`/api/discogs/label/${selectedLabel.id}/releases`);
      if (!res.ok) throw new Error('Failed to fetch label releases');
      return res.json();
    },
    enabled: !!selectedLabel?.id
  });

  const releases = data?.releases || [];
  
  // Group releases by artist
  const releasesByArtist = releases.reduce((groups: any, release: any) => {
    const artist = release.artist || 'Unknown Artist';
    if (!groups[artist]) {
      groups[artist] = [];
    }
    groups[artist].push(release);
    return groups;
  }, {});

  // Track which releases need track details loaded
  const releasesToLoad = [...selectedReleases, ...Array.from(expandedReleases).map(id => 
    releases.find(r => r.id === id)
  ).filter(Boolean)];
  
  // Only load track details for selected releases and expanded releases
  const trackQueries = useQueries({
    queries: releasesToLoad.map((release: any) => ({
      queryKey: ['release', release.id],
      queryFn: async () => {
        const res = await fetch(`/api/discogs/release/${release.id}`);
        if (!res.ok) throw new Error('Failed to fetch release details');
        const data = await res.json();
        
        // Process tracks similar to artist releases
        const processedTracks = data.tracklist?.map((track: any) => ({
          position: track.position,
          title: track.title,
          duration: track.duration,
          writers: track.extraartists?.filter((artist: any) => 
            artist.role?.toLowerCase().includes('written') || 
            artist.role?.toLowerCase().includes('composer')
          )?.map((artist: any) => artist.name) || [],
          producers: track.extraartists?.filter((artist: any) => 
            artist.role?.toLowerCase().includes('producer')
          )?.map((artist: any) => artist.name) || []
        })) || [];

        return {
          ...data,
          processedTracks,
          displayYear: data.year || 'Unknown',
          displayLabel: data.labels?.[0]?.name || 'Unknown',
          displayFormat: data.formats?.map((f: any) => f.name).join(', ') || 'Unknown'
        };
      },
      staleTime: Infinity,
    }))
  });

  const getTrackData = (releaseId: string) => {
    const queryIndex = releasesToLoad.findIndex((r: any) => r.id === releaseId);
    return queryIndex >= 0 ? trackQueries[queryIndex] : null;
  };

  // Add track details to selection store when available
  useEffect(() => {
    trackQueries.forEach((query, index) => {
      if (query.data && releasesToLoad[index] && !query.isLoading && !query.error) {
        addTrackDetails(releasesToLoad[index].id, query.data);
      }
    });
  }, [trackQueries.map(q => q.data).join(','), releasesToLoad.map(r => r?.id || '').join(','), addTrackDetails]);

  const toggleReleaseExpansion = (releaseId: string) => {
    setExpandedReleases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(releaseId)) {
        newSet.delete(releaseId);
      } else {
        newSet.add(releaseId);
      }
      return newSet;
    });
  };

  const isReleaseSelected = (release: any) => {
    return selectedReleases.some(r => r.id === release.id);
  };

  const handleReleaseToggle = (release: any) => {
    toggleRelease({
      id: release.id,
      title: release.title,
      year: release.year || 0,
      labels: release.label ? [{ name: selectedLabel?.title }] : [],
      formats: [release.format],
      country: release.country
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
              <div className="absolute top-0 w-16 h-16 border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading label releases...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-destructive">Failed to load releases</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please try again later
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!releases.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No releases found for this label</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalReleases = data?.pagination?.items || releases.length;
  const selectedCount = selectedReleases.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Label Releases
              <Badge variant="secondary">
                {totalReleases} total
              </Badge>
              {selectedCount > 0 && (
                <Badge variant="default">
                  {selectedCount} selected
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupedByArtist(!groupedByArtist)}
            >
              {groupedByArtist ? 'List View' : 'Group by Artist'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-y-auto space-y-4">
        {groupedByArtist ? (
          // Grouped by Artist View
          Object.entries(releasesByArtist).map(([artist, artistReleases]: [string, any[]]) => (
            <Card key={artist} className="border-l-4 border-l-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  {artist}
                  <Badge variant="outline" className="ml-auto">
                    {artistReleases.length} releases
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {artistReleases.map((release: any) => (
                  <LabelReleaseItem
                    key={release.id}
                    release={release}
                    isExpanded={expandedReleases.has(release.id)}
                    isSelected={isReleaseSelected(release)}
                    onToggleExpansion={() => toggleReleaseExpansion(release.id)}
                    onToggleSelection={() => handleReleaseToggle(release)}
                    trackData={getTrackData(release.id)}
                  />
                ))}
              </CardContent>
            </Card>
          ))
        ) : (
          // List View
          <div className="space-y-3">
            {releases.map((release: any) => (
              <LabelReleaseItem
                key={release.id}
                release={release}
                isExpanded={expandedReleases.has(release.id)}
                isSelected={isReleaseSelected(release)}
                onToggleExpansion={() => toggleReleaseExpansion(release.id)}
                onToggleSelection={() => handleReleaseToggle(release)}
                trackData={getTrackData(release.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}