'use client';

import { SearchForm } from '@/components/search-form';
import { ReleasesWithTracks } from '@/components/releases-with-tracks';
import { ExportButton } from '@/components/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
          
          {/* Export Data - Desktop only */}
          {selectedArtist && (
            <Card className="mt-6 hidden lg:block">
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
        </div>
        
        <div className="lg:col-span-2">
          {selectedArtist ? (
            <ReleasesWithTracks />
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
      
      {/* Export Data - Mobile only */}
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
    </div>
  );
}