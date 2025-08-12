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

// Component to display recent search as an artist card
function RecentSearchCard({ search, onSelect, onRemove }: { search: any; onSelect: (artist: any) => void; onRemove: (id: string) => void }) {
  // Fetch artist details for the profile image
  const { data: artistDetails, isLoading } = useQuery({
    queryKey: ['artist', search.artistId],
    queryFn: async () => {
      if (!search.artistId) return null;
      const res = await fetch(`/api/discogs/artist/${search.artistId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!search.artistId
  });

  const handleClick = () => {
    // Reconstruct artist object for selection
    const artist = {
      id: search.artistId,
      title: search.artistName,
      type: 'artist' // Default type
    };
    onSelect(artist);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    onRemove(search.id);
  };

  return (
    <div 
      className="group relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-lg cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all duration-200"
      onClick={handleClick}
      title="Click to select this artist"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : artistDetails?.profileImage ? (
                <img
                  src={artistDetails.profileImage.uri150 || artistDetails.profileImage.uri}
                  alt={search.artistName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <User className={`w-7 h-7 text-primary ${artistDetails?.profileImage ? 'hidden' : ''}`} />
            </div>
            <div>
              <div className="mb-1">
                <h3 className="text-xl font-bold">{search.artistName}</h3>
                {artistDetails?.realname && artistDetails.realname !== search.artistName && (
                  <p className="text-sm text-muted-foreground font-medium">
                    {artistDetails.realname}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Searched {new Date(search.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            title="Remove from search history"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { selectedArtist, selectedLabel, clearSelection, setSelectedArtist } = useSelectionStore();
  const { getRecentArtistSearches, removeSearch } = useHistoryStore();
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const handleClearSelection = () => {
    clearSelection();
  };

  // Get recent searches only on client-side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    setRecentSearches(getRecentArtistSearches(5));
  }, [getRecentArtistSearches]);
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Music Metadata Extractor</h1>
        <p className="text-muted-foreground">
          Extract detailed music metadata from Discogs for legal contract work
        </p>
      </div>
      
      {/* Main Tabs */}
      <Tabs defaultValue="artist" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="artist" className="flex items-center gap-2">
            <Music className="w-4 h-4" />
            Artist Search
          </TabsTrigger>
          <TabsTrigger value="label" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Label Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artist">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Search Artist</CardTitle>
                {selectedArtist && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleClearSelection}
                    className="border-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all"
                    title="Clear selection and search again"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Search for a different artist
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <SearchForm />
            </CardContent>
          </Card>

          {selectedArtist ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Export Data - Desktop sidebar */}
              <div className="lg:col-span-1">
                <Card className="hidden lg:block">
                  <CardHeader>
                    <CardTitle>Export Data</CardTitle>
                    <CardDescription>
                      Download selected releases as spreadsheet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExportButton />
                  </CardContent>
                </Card>
              </div>
              
              {/* Releases & Tracks - Takes remaining space */}
              <div className="lg:col-span-2">
                <ReleasesWithTracks />
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Artist Searches</CardTitle>
                <CardDescription>
                  {isMounted && recentSearches.length > 0 ? 'Click on any artist to select them again' : 'Your artist search history will appear here'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isMounted ? (
                  recentSearches.length > 0 ? (
                    <div className="space-y-4">
                      {recentSearches.map((search) => (
                        <RecentSearchCard 
                          key={search.id} 
                          search={search} 
                          onSelect={setSelectedArtist}
                          onRemove={removeSearch}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-8">
                      <p className="text-center text-muted-foreground">
                        Search for an artist to begin
                      </p>
                    </div>
                  )
                ) : (
                  <div className="py-8">
                    <p className="text-center text-muted-foreground">
                      Loading search history...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Export Data - Mobile full width */}
          {selectedArtist && (
            <Card className="mt-6 lg:hidden">
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download selected releases as spreadsheet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportButton />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="label">
          <LabelSearchForm />
          
          {selectedLabel ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Export Data - Desktop sidebar */}
              <div className="lg:col-span-1">
                <Card className="hidden lg:block">
                  <CardHeader>
                    <CardTitle>Export Data</CardTitle>
                    <CardDescription>
                      Download selected releases as spreadsheet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExportButton />
                  </CardContent>
                </Card>
              </div>
              
              {/* Label Releases - Takes remaining space */}
              <div className="lg:col-span-2">
                <LabelReleases />
              </div>
            </div>
          ) : null}
          
          {/* Export Data - Mobile full width */}
          {selectedLabel && (
            <Card className="mt-6 lg:hidden">
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download selected releases as spreadsheet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportButton />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}