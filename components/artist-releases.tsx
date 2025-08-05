'use client';

import { useQuery } from '@tanstack/react-query';
import { useSelectionStore } from '@/stores/selection-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download } from 'lucide-react';

export function ArtistReleases() {
  const { selectedArtist, selectedReleases, toggleRelease } = useSelectionStore();
  
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
  
  const releases = data?.releases || [];
  const mainReleases = releases.filter((r: any) => 
    r.type === 'master' || r.role === 'Main'
  );
  
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
                <div className="flex-1">
                  <p className="font-medium">{release.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {release.year} • {release.label} • {release.format}
                  </p>
                </div>
                {release.stats && (
                  <Badge variant="outline">
                    {release.stats.community?.in_collection || 0} collected
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedReleases.length} releases selected for export
          </p>
        </div>
      </CardContent>
    </Card>
  );
}