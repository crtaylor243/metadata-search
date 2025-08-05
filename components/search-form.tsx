'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2 } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { useHistoryStore } from '@/stores/history-store';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const setSelectedArtist = useSelectionStore(state => state.setSelectedArtist);
  const addSearch = useHistoryStore(state => state.addSearch);
  
  const { data, isLoading, error } = useQuery({
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
    }
  };
  
  const handleSelectArtist = (artist: any) => {
    setSelectedArtist(artist);
    addSearch({
      query: searchTerm,
      resultCount: data?.results?.length || 0,
      artistName: artist.title,
      artistId: artist.id
    });
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
      </form>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Search failed. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
      
      {data?.results && (
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