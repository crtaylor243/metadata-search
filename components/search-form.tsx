'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, X, Music, User, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { useHistoryStore } from '@/stores/history-store';
import { cn } from '@/lib/utils';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isArtistSelected, setIsArtistSelected] = useState(false);
  
  const { selectedArtist, setSelectedArtist, clearSelection } = useSelectionStore();
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
    <div className="space-y-6">
      {/* Search Input Section */}
      <div className="space-y-2">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for an artist (e.g., Metallica, The Beatles, Pink Floyd)"
                className="pl-10 pr-4 h-12 text-base border-2 focus:border-primary transition-colors"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !query.trim()}
              size="lg"
              className="h-12 px-6 font-medium shadow-sm hover:shadow-md transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            {(searchTerm || selectedArtist) && (
              <Button 
                type="button" 
                variant="outline" 
                size="lg"
                onClick={handleClear}
                className="h-12 px-4 border-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all"
                title="Clear search and selection"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </form>
        
        {/* Search hints */}
        {!searchTerm && !selectedArtist && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Try searching for popular artists to explore their discography
          </p>
        )}
      </div>
      
      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Search failed. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Selected Artist Card */}
      {isArtistSelected && selectedArtist && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold">{selectedArtist.title}</h3>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Selected
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Artist ID: {selectedArtist.id}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsArtistSelected(false)}
                className="hover:bg-background/80"
              >
                Change Artist
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Search Results */}
      {!isArtistSelected && data?.results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Search Results</h3>
            <Badge variant="secondary" className="text-sm">
              {data.results.length} {data.results.length === 1 ? 'result' : 'results'}
            </Badge>
          </div>
          
          <div className="grid gap-3">
            {data.results.map((artist: any, index: number) => (
              <div
                key={artist.id}
                onClick={() => handleSelectArtist(artist)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border-2 p-4 cursor-pointer",
                  "transition-all duration-200 hover:shadow-lg hover:border-primary/50",
                  "hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent",
                  "bg-card"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeInUp 0.4s ease-out forwards',
                  opacity: 0
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Music className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {artist.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {artist.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ID: {artist.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Select
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
            <div className="absolute top-0 w-16 h-16 border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            Searching for artists...
          </p>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}