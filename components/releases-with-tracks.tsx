'use client';

import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

export function ReleasesWithTracks() {
  const { selectedArtist, selectedReleases, toggleRelease } = useSelectionStore();
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = useQuery({
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

  // Get track details for all main releases to have complete metadata
  const trackQueries = useQueries({
    queries: mainReleases.map((release: any) => ({
      queryKey: ['release', release.id],
      queryFn: async () => {
        const res = await fetch(`/api/discogs/release/${release.id}`);
        if (!res.ok) throw new Error('Failed to fetch release details');
        return res.json();
      },
      staleTime: Infinity,
    }))
  });

  const toggleExpanded = (releaseId: string) => {
    const newExpanded = new Set(expandedReleases);
    if (newExpanded.has(releaseId)) {
      newExpanded.delete(releaseId);
    } else {
      newExpanded.add(releaseId);
    }
    setExpandedReleases(newExpanded);
  };

  const toggleShowAll = () => {
    if (showAll) {
      setExpandedReleases(new Set());
      setShowAll(false);
    } else {
      const allReleaseIds = new Set(mainReleases.map((r: any) => r.id));
      setExpandedReleases(allReleaseIds);
      setShowAll(true);
    }
  };

  const getTrackData = (releaseId: string) => {
    const queryIndex = mainReleases.findIndex((r: any) => r.id === releaseId);
    return queryIndex >= 0 ? trackQueries[queryIndex] : null;
  };

  if (!selectedArtist) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">
            Failed to load releases. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{selectedArtist.title} - Releases & Tracks</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleShowAll}
            >
              {showAll ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide All
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show All
                </>
              )}
            </Button>
            <Badge>{releases.length} total</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {mainReleases.map((release: any) => {
            const isSelected = selectedReleases.some(r => r.id === release.id);
            const isExpanded = expandedReleases.has(release.id);
            const trackQuery = getTrackData(release.id);
            
            // Use detailed data if available, fallback to basic data
            const detailedData = trackQuery?.data;
            const displayYear = detailedData?.displayYear || release.year || 'Unknown';
            const displayLabel = detailedData?.displayLabel || release.label || 'Unknown';
            const displayFormat = detailedData?.displayFormat || release.format || 'Unknown';
            
            return (
              <Collapsible key={release.id} open={isExpanded} onOpenChange={() => toggleExpanded(release.id)}>
                <div className="border rounded-lg">
                  {/* Release Header */}
                  <div className="flex items-center space-x-3 p-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRelease(release)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium">{release.title}</p>
                          <p className="text-sm text-muted-foreground break-words">
                            {displayYear} • {displayLabel} • {displayFormat}
                          </p>
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
                    </div>
                  </div>

                  {/* Track Listing */}
                  <CollapsibleContent>
                    <div className="border-t bg-muted/30 p-4">
                      {trackQuery?.isLoading && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading tracks...
                        </div>
                      )}
                      
                      {trackQuery?.error && (
                        <p className="text-center text-destructive py-4">
                          Failed to load tracks
                        </p>
                      )}
                      
                      {trackQuery?.data?.processedTracks && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">Track Listing</h4>
                          <div className="space-y-2">
                            {trackQuery.data.processedTracks.map((track: any) => (
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
          })}
        </div>
      </CardContent>
    </Card>
  );
}