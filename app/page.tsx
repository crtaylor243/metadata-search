'use client';

import { SearchForm } from '@/components/search-form';
import { ReleasesWithTracks } from '@/components/releases-with-tracks';
import { ExportButton } from '@/components/export-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';

export default function Home() {
  const { selectedArtist, clearSelection } = useSelectionStore();
  
  const handleClearSelection = () => {
    clearSelection();
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Music Metadata Extractor</h1>
        <p className="text-muted-foreground">
          Extract detailed music metadata from Discogs for legal contract work
        </p>
      </div>
      
      {/* Search Artist - Full width at top */}
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
          <CardContent className="py-16">
            <p className="text-center text-muted-foreground">
              Search for an artist to begin
            </p>
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
    </div>
  );
}