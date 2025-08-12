'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download } from 'lucide-react';

export function ArtistReleases() {
  const { selectedArtist, selectedReleases, toggleRelease } = useSelectionStore();
  const autoSelectedRef = useRef<string | null>(null);
  
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
  
  // Auto-select all main releases when they load (temporarily disabled)
  // useEffect(() => {
  //   const artistId = selectedArtist?.id;
  //   if (mainReleases.length > 0 && artistId && autoSelectedRef.current !== artistId) {
  //     // Mark this artist as auto-selected
  //     autoSelectedRef.current = artistId;
  //     
  //     // Auto-select all main releases
  //     mainReleases.forEach((release: any) => {
  //       toggleRelease(release);
  //     });
  //   }
  // }, [mainReleases, selectedArtist?.id, toggleRelease]);
  
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
          <span>{selectedArtist.title} - Releases</span>
          <Badge>{releases.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {mainReleases.map((release: any) => {
            const isSelected = selectedReleases.some(r => r.id === release.id);
            
            return (
              <div
                key={release.id}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleRelease(release)}
                />
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {release.thumb ? (
                    <img
                      src={release.thumb}
                      alt={release.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Download className={`w-5 h-5 text-muted-foreground ${release.thumb ? 'hidden' : ''}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{release.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {release.year} • {release.label} • {release.format}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedReleases.length} releases selected for export
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  mainReleases.forEach((release: any) => {
                    const isSelected = selectedReleases.some(r => r.id === release.id);
                    if (!isSelected) {
                      toggleRelease(release);
                    }
                  });
                }}
                disabled={selectedReleases.length === mainReleases.length}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  selectedReleases.forEach((release: any) => {
                    if (mainReleases.some(r => r.id === release.id)) {
                      toggleRelease(release);
                    }
                  });
                }}
                disabled={selectedReleases.length === 0}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}