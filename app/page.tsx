'use client';

import { SearchForm } from '@/components/search-form';
import { ArtistReleases } from '@/components/artist-releases';
import { TrackDetails } from '@/components/track-details';
import { ExportButton } from '@/components/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSelectionStore } from '@/stores/selection-store';

export default function Home() {
  const selectedArtist = useSelectionStore(state => state.selectedArtist);
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Music Metadata Extractor</h1>
        <p className="text-muted-foreground">
          Extract detailed music metadata from Discogs for legal contract work
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Search Artist</CardTitle>
              <CardDescription>
                Start by searching for an artist name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchForm />
            </CardContent>
          </Card>
          
          {selectedArtist && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download selected releases as Excel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportButton />
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-2">
          {selectedArtist ? (
            <Tabs defaultValue="releases" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="releases">Select Releases</TabsTrigger>
                <TabsTrigger value="tracks">Track Details</TabsTrigger>
              </TabsList>
              <TabsContent value="releases">
                <ArtistReleases />
              </TabsContent>
              <TabsContent value="tracks">
                <TrackDetails />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-16">
                <p className="text-center text-muted-foreground">
                  Search for an artist to begin
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}