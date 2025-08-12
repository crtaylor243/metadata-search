'use client';

import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function TrackDetails() {
  const { selectedReleases, addTrackDetails } = useSelectionStore();
  
  const queries = useQueries({
    queries: selectedReleases.map(release => ({
      queryKey: ['release', release.id],
      queryFn: async () => {
        const res = await fetch(`/api/discogs/release/${release.id}`);
        if (!res.ok) throw new Error('Failed to fetch release details');
        return res.json();
      },
      staleTime: Infinity,
    }))
  });
  
  useEffect(() => {
    queries.forEach((query, index) => {
      if (query.data && selectedReleases[index]) {
        addTrackDetails(selectedReleases[index].id, query.data);
      }
    });
  }, [queries, selectedReleases]);
  
  const isLoading = queries.some(q => q.isLoading);
  const loadedCount = queries.filter(q => q.isSuccess).length;
  
  if (selectedReleases.length === 0) {
    return null;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Track Details</span>
          {isLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Loading {loadedCount}/{selectedReleases.length}
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {queries.map((query, index) => {
              if (!query.data) return null;
              
              const release = selectedReleases[index];
              const tracks = query.data.processedTracks || [];
              
              return (
                <div key={release.id} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{release.title}</h4>
                  <div className="space-y-2">
                    {tracks.map((track: any) => (
                      <div key={track.position} className="text-sm">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {track.position}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium">{track.title}</p>
                            {track.writers?.length > 0 && (
                              <p className="text-muted-foreground">
                                Writers: {track.writers.join(', ')}
                              </p>
                            )}
                            {track.producers?.length > 0 && (
                              <p className="text-muted-foreground">
                                Producers: {track.producers.join(', ')}
                              </p>
                            )}
                            {track.duration && (
                              <p className="text-muted-foreground">
                                Duration: {track.duration}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}