'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2, X } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { useHistoryStore } from '@/stores/history-store';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isArtistSelected, setIsArtistSelected] = useState(false);
  
  const { selectedArtist, setSelectedArtist, clearSelection } = useSelectionStore();
  const addSearch = useHistoryStore(state => state.addSearch);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['search', searchTerm],
    queryFn: async () => {
      if (!searchTerm) return null;
      const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(searchTerm)}&type=artist`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!searchTerm
  });
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
      setIsArtistSelected(false);
    }
  };
  
  const handleSelectArtist = (artist: any) => {
    setSelectedArtist(artist);
    setIsArtistSelected(true);
    addSearch({
      query: searchTerm,
      resultCount: data?.results?.length || 0,
      artistName: artist.title,
      artistId: artist.id
    });
  };
  
  const handleClear = () => {
    setQuery('');
    setSearchTerm('');
    setIsArtistSelected(false);
    clearSelection();
  };
  
  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for an artist (e.g., Metallica)"
          className="flex-1"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Search
        </Button>
        {(searchTerm || selectedArtist) && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClear}
            title="Clear search and selection"
          >
            <X className="w-4 h-4" />
            Clear
          </Button>
        )}
      </form>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Search failed. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Show selected artist */}
      {isArtistSelected && selectedArtist && (
        <div className="p-4 border rounded-lg bg-accent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selectedArtist.title}</h3>
              <p className="text-sm text-muted-foreground">
                Selected • ID: {selectedArtist.id}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsArtistSelected(false)}
            >
              Change Artist
            </Button>
          </div>
        </div>
      )}
      
      {/* Show search results only when no artist is selected */}
      {!isArtistSelected && data?.results && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Found {data.results.length} results
          </p>
          {data.results.map((artist: any) => (
            <div
              key={artist.id}
              onClick={() => handleSelectArtist(artist)}
              className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{artist.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {artist.type} • ID: {artist.id}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Select
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}