'use client';

import { SearchForm } from '@/components/search-form';
import { LabelSearchForm } from '@/components/label-search-form';
import { LabelReleases } from '@/components/label-releases';
import { ReleasesWithTracks } from '@/components/releases-with-tracks';
import { ExportButton } from '@/components/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, User, Loader2, Music, Tag } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { useHistoryStore } from '@/stores/history-store';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DesignModeToggle } from '@/components/design-mode-toggle';
import { useDesignMode } from '@/hooks/use-design-mode';
import { EmptyState } from '@/components/ui/empty-state';
import { Cluster, PageShell, Section, Stack } from '@/components/ui/layout';

function RecentSearchCard({ search, onSelect, onRemove, redesign }: { search: any; onSelect: (artist: any) => void; onRemove: (id: string) => void; redesign: boolean }) {
  const { data: artistDetails, isLoading } = useQuery({
    queryKey: ['artist', search.artistId],
    queryFn: async () => {
      if (!search.artistId) return null;
      const res = await fetch(`/api/discogs/artist/${search.artistId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!search.artistId,
  });

  const handleClick = () => onSelect({ id: search.artistId, title: search.artistName, type: 'artist' });

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative w-full overflow-hidden rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 ${redesign ? 'surface-subtle hover:surface-quiet card-redesign' : 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/30'}`}
      title="Click to select this artist"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-12 overflow-hidden rounded-full bg-muted flex items-center justify-center">
            {isLoading ? <Loader2 className="size-5 animate-spin" /> : artistDetails?.profileImage ? (
              <img
                src={artistDetails.profileImage.uri150 || artistDetails.profileImage.uri}
                alt={search.artistName}
                className="h-full w-full object-cover"
              />
            ) : null}
            <User className={`size-5 ${artistDetails?.profileImage ? 'hidden' : ''}`} />
          </div>
          <div>
            <p className="kicker">Artist</p>
            <h3 className="text-lg font-semibold tracking-tight uppercase">{search.artistName}</h3>
            {artistDetails?.realname && artistDetails.realname !== search.artistName ? (
              <p className="text-sm text-muted-foreground">{artistDetails.realname}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">Searched {new Date(search.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(search.id);
          }}
          className="opacity-60 hover:opacity-100"
          title="Remove from search history"
        >
          <X className="size-4" />
        </Button>
      </div>
    </button>
  );
}

export default function Home() {
  const { selectedArtist, selectedLabel, clearSelection, setSelectedArtist } = useSelectionStore();
  const { getRecentArtistSearches, removeSearch } = useHistoryStore();
  const { mode, setMode, isRedesignEnabled } = useDesignMode();
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setRecentSearches(getRecentArtistSearches(5));
  }, [getRecentArtistSearches]);

  return (
    <PageShell className={isRedesignEnabled ? 'design-new' : 'design-classic'}>
      <Section>
        <header className="editorial-divider flex flex-wrap items-center justify-between gap-3 py-5">
          <Cluster>
            <button onClick={clearSelection} className="size-10 rounded-md transition-opacity hover:opacity-80" title="Home - Clear selection" aria-label="Home">
              <img src="/icon.svg" alt="Home" className="h-full w-full" />
            </button>
            <div>
              <p className="kicker">Discogs metadata explorer</p>
              <h1 className="text-3xl font-semibold uppercase tracking-[0.08em] md:text-4xl">Discography Search</h1>
            </div>
          </Cluster>
          <DesignModeToggle mode={mode} onChange={setMode} />
        </header>

        <Tabs defaultValue="label" className="w-full">
          <TabsList className="mb-5">
            <TabsTrigger value="label" className="flex items-center gap-2"><Tag className="size-4" />Label Search</TabsTrigger>
            <TabsTrigger value="artist" className="flex items-center gap-2"><Music className="size-4" />Artist Search</TabsTrigger>
          </TabsList>

          <TabsContent value="label">
            <Stack>
              <LabelSearchForm />
              {selectedLabel ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-1"><Card className="card-redesign"><CardHeader><p className="kicker">Action</p><CardTitle className="text-xl font-semibold uppercase tracking-[0.06em]">Export Data</CardTitle><CardDescription>Download selected releases as spreadsheet</CardDescription></CardHeader><CardContent><ExportButton /></CardContent></Card></div>
                  <div className="lg:col-span-2"><LabelReleases /></div>
                </div>
              ) : null}
            </Stack>
          </TabsContent>

          <TabsContent value="artist">
            <Stack>
              <Card className="card-redesign">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="kicker">Discovery</p>
                      <CardTitle className="text-xl font-semibold uppercase tracking-[0.06em]">Search Artist</CardTitle>
                    </div>
                    {selectedArtist ? <Button type="button" variant="outline" size="sm" onClick={clearSelection}><X className="mr-2 size-4" />Search again</Button> : null}
                  </div>
                </CardHeader>
                <CardContent><SearchForm /></CardContent>
              </Card>

              {selectedArtist ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-1"><Card className="card-redesign"><CardHeader><p className="kicker">Action</p><CardTitle className="text-xl font-semibold uppercase tracking-[0.06em]">Export Data</CardTitle><CardDescription>Download selected releases as spreadsheet</CardDescription></CardHeader><CardContent><ExportButton /></CardContent></Card></div>
                  <div className="lg:col-span-2"><ReleasesWithTracks /></div>
                </div>
              ) : (
                <Card className="card-redesign">
                  <CardHeader>
                    <p className="kicker">History</p>
                    <CardTitle className="text-xl font-semibold uppercase tracking-[0.06em]">Recent Artist Searches</CardTitle>
                    <CardDescription>{isMounted && recentSearches.length > 0 ? 'Select an artist to continue quickly.' : 'Your artist search history will appear here.'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isMounted ? recentSearches.length > 0 ? (
                      <Stack>
                        {recentSearches.map((search) => <RecentSearchCard key={search.id} search={search} onSelect={setSelectedArtist} onRemove={removeSearch} redesign={isRedesignEnabled} />)}
                      </Stack>
                    ) : (
                      <EmptyState title="No recent artist searches" description="Search for an artist to populate your history." />
                    ) : (
                      <EmptyState title="Loading search history" description="Preparing your recent searches." />
                    )}
                  </CardContent>
                </Card>
              )}
            </Stack>
          </TabsContent>
        </Tabs>
      </Section>
    </PageShell>
  );
}
