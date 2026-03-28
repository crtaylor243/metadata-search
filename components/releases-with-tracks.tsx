'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Eye, EyeOff, Music2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

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

  // Database returns only main artist releases (already filtered by INNER JOIN)
  // Track data is now included in the releases response, no need for separate queries
  const mainReleases = releases;

  // Create a Set of selected release IDs for O(1) lookup performance
  // This prevents O(n) array.some() calls when rendering many releases
  const selectedReleaseIds = new Set(selectedReleases.map(r => r.id));

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

  if (!selectedArtist) return null;

  if (isLoading) {
    return (
      <Card className="card-redesign">
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="card-redesign">
        <CardContent className="py-8">
          <EmptyState title="Could not load releases" description="Please retry in a few moments." />
        </CardContent>
      </Card>
    );
  }

  if (!mainReleases.length) {
    return (
      <Card className="card-redesign">
        <CardContent className="py-8">
          <EmptyState title="No releases found" description="Try another artist or adjust your search." icon={<Music2 className='size-5' />} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-redesign">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Releases & Tracks</span>
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
        {/* Release count */}
        <div className="flex items-center justify-between pb-4 border-b">
          <Badge variant="outline" className="text-xs">
            {mainReleases.length} releases
          </Badge>
        </div>

        <div className="space-y-4 mt-4 lg:max-h-none lg:overflow-y-visible max-h-96 overflow-y-auto">
          {mainReleases.map((release: any) => {
            const isSelected = selectedReleaseIds.has(release.id);
            const isExpanded = expandedReleases.has(release.id);

            // Track data is now included in the release object from the database
            const displayYear = release.year || 'Unknown';
            const displayLabel = release.label || 'Unknown';

            // Display multiple formats if available from the array, otherwise use the string
            let displayFormat = 'Unknown';
            if (release.format_names && release.format_names.length > 0) {
              displayFormat = release.format_names.join(', ');
            } else if (release.format) {
              displayFormat = release.format;
            }
            
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
                          <div className="text-sm text-muted-foreground">
                            {/* Format table matching label releases style */}
                            {release.format_names && release.format_names.length > 0 ? (
                              <div className="mt-2 max-w-md">
                                <div className="border rounded-md overflow-hidden">
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {release.format_names.map((format: string, idx: number) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                          <td className="px-2 py-1">{format}</td>
                                          <td className="px-2 py-1 font-mono">
                                            {release.label_names?.[idx] || displayLabel}
                                          </td>
                                          <td className="px-2 py-1">{displayYear}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              /* Fallback if no format_names */
                              <div className="mt-1">
                                {displayYear} • {displayLabel} • {displayFormat}
                              </div>
                            )}
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
                    </div>
                  </div>

                  {/* Track Listing */}
                  <CollapsibleContent>
                    <div className="border-t bg-muted/30 p-4">
                      {release.tracks && release.tracks.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">Track Listing</h4>
                          <div className="space-y-2">
                            {release.tracks.map((track: any, index: number) => (
                              <div key={`${release.id}-${track.position}-${index}`} className="text-sm">
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
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">
                          No tracks available for this release
                        </p>
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