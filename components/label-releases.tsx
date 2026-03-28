'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Music } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Individual release component with expandable tracks
function LabelReleaseItem({
  release,
  isExpanded,
  isSelected,
  onToggleExpansion,
  onToggleSelection
}: {
  release: any;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpansion: () => void;
  onToggleSelection: () => void;
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
              <div className="flex items-start gap-2 mb-1">
                <h3 className="font-medium leading-tight break-words">
                  {release.artist && (
                    <span className="text-muted-foreground">{release.artist} - </span>
                  )}
                  {release.title}
                  <span className="text-xs text-muted-foreground ml-2 font-mono">
                    (ID: {release.id})
                  </span>
                </h3>
              </div>
              <div className="text-sm text-muted-foreground">
                
                {/* Format Variants Table */}
                {release.formatVariants && release.formatVariants.length > 0 ? (
                  <div className="mt-2 max-w-md">
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody>
                          {release.formatVariants
                            .sort((a: any, b: any) => (a.year || 9999) - (b.year || 9999))
                            .map((variant: any, index: number) => (
                            <tr key={variant.id || index} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                              <td className="px-2 py-1">{variant.format || 'Unknown'}</td>
                              <td className="px-2 py-1 font-mono">{variant.catno || '—'}</td>
                              <td className="px-2 py-1">{variant.year || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Fallback if no formatVariants */
                  <div className="flex items-center gap-2">
                    {release.format && (
                      <span className="bg-muted px-2 py-1 rounded text-xs">
                        {release.format}
                      </span>
                    )}
                    {release.catno && (
                      <span className="font-mono">Cat: {release.catno}</span>
                    )}
                  </div>
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
}

export function LabelReleases() {
  const { selectedLabel, selectedReleases, toggleRelease } = useSelectionStore();
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

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

  // Releases are already sorted by catalog number from the API
  // Track data is now included in the releases response
  const allReleases = data?.releases || [];

  // Calculate pagination
  const totalPages = Math.ceil(allReleases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const releases = allReleases.slice(startIndex, endIndex);

  // Reset to page 1 when label changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedReleases(new Set());
  }, [selectedLabel?.id]);

  // Create a Set of selected release IDs for O(1) lookup performance
  // This prevents O(n) array.some() calls when rendering releases
  const selectedReleaseIds = new Set(selectedReleases.map(r => r.id));

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
    return selectedReleaseIds.has(release.id);
  };

  const handleReleaseToggle = (release: any) => {
    toggleRelease({
      id: release.id,
      title: release.title,
      year: release.year || 0,
      labels: release.label ? [{ name: selectedLabel?.title }] : [],
      formats: [release.format],
      country: release.country,
      artist: release.artist // Include artist for label exports
    });
  };

  if (isLoading) {
    return (
      <Card className="card-redesign">
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="card-redesign">
        <CardContent className="py-8">
          <EmptyState title="Failed to load releases" description="Please try again later." />
        </CardContent>
      </Card>
    );
  }

  if (!releases.length) {
    return (
      <Card className="card-redesign">
        <CardContent className="py-8">
          <EmptyState title="No releases found" description="Try a different label or broaden your search." icon={<Music className='size-5' />} />
        </CardContent>
      </Card>
    );
  }

  const totalReleases = data?.pagination?.items || releases.length;
  const selectedCount = selectedReleases.length;

  return (
    <Card className="card-redesign">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Label Releases
              {selectedCount > 0 && (
                <Badge variant="default">
                  {selectedCount} selected
                </Badge>
              )}
              <Badge variant="secondary">
                {totalReleases} total
              </Badge>
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pagination Controls - Top */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="w-9 px-2"
              >
                ⟦
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-9 px-2"
              >
                ‹
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({startIndex + 1}-{Math.min(endIndex, allReleases.length)} of {allReleases.length} releases)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-9 px-2"
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="w-9 px-2"
              >
                ⟧
              </Button>
            </div>
          </div>
        )}

        {/* Releases List */}
        <div className="max-h-[600px] overflow-y-auto space-y-3">
          {releases.map((release: any) => (
            <LabelReleaseItem
              key={release.id}
              release={release}
              isExpanded={expandedReleases.has(release.id)}
              isSelected={isReleaseSelected(release)}
              onToggleExpansion={() => toggleReleaseExpansion(release.id)}
              onToggleSelection={() => handleReleaseToggle(release)}
            />
          ))}
        </div>

        {/* Pagination Controls - Bottom */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="w-9 px-2"
              >
                ⟦
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-9 px-2"
              >
                ‹
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-9 px-2"
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="w-9 px-2"
              >
                ⟧
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}