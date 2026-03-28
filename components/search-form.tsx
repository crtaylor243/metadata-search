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
import { parseDiscogsLinks } from '@/lib/discogs-links';

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // Fetch artist details including profile image when artist is selected
  const { data: artistDetails, isLoading: artistLoading } = useQuery({
    queryKey: ['artist', selectedArtist?.id],
    queryFn: async () => {
      if (!selectedArtist?.id) return null;
      const res = await fetch(`/api/discogs/artist/${selectedArtist.id}`);
      if (!res.ok) throw new Error('Failed to fetch artist details');
      return res.json();
    },
    enabled: !!selectedArtist?.id
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
      artistId: artist.id,
      type: 'artist'
    });
  };
  
  const handleClear = () => {
    setQuery('');
    setSearchTerm('');
    clearSelection();
  };
  
  return (
    <div className="space-y-6">
      {/* Search Input Section - Hide when artist is selected */}
      {!selectedArtist && (
        <div className="space-y-2">
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for an artist"
                className="h-11 w-full border-border pl-10 pr-4 text-base"
              />
            </div>
            
            {/* Search Buttons */}
            <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={isLoading || !query.trim()}
              size="lg"
              className="h-11 px-6 font-medium"
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
            {searchTerm && (
              <Button 
                type="button" 
                variant="outline" 
                size="lg"
                onClick={handleClear}
                className="h-11 px-4"
                title="Clear search and selection"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </form>
        
      </div>
      )}

      
      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Search failed. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Selected Artist Card */}
      {selectedArtist && (
        <div 
          className="relative cursor-pointer overflow-hidden rounded-[var(--radius)] border border-border bg-card p-6 transition-colors hover:bg-secondary/60"
          onClick={() => window.open(`https://www.discogs.com/artist/${selectedArtist.id}`, '_blank')}
          title="Click to view on Discogs"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {artistLoading ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : artistDetails?.profileImage ? (
                    <img
                      src={artistDetails.profileImage.uri150 || artistDetails.profileImage.uri}
                      alt={selectedArtist.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to User icon if image fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <User className={`w-7 h-7 text-primary ${artistDetails?.profileImage ? 'hidden' : ''}`} />
                </div>
                <div>
                  <div className="mb-1">
                    <h3 className="text-xl font-bold">{selectedArtist.title}</h3>
                    {artistDetails?.realname && artistDetails.realname !== selectedArtist.title && (
                      <p className="text-sm text-muted-foreground font-medium">
                        {artistDetails.realname}
                      </p>
                    )}
                  </div>
                  {artistDetails?.profile ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {parseDiscogsLinks(artistDetails.profile)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Artist ID: {selectedArtist.id}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Search Results */}
      {!selectedArtist && data?.results && (
        <div className="space-y-4">
          {(() => {
            const filteredResults = data.results;
            
            return (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Search Results</h3>
                  <Badge variant="secondary" className="text-sm">
                    {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
                  </Badge>
                </div>
                
                <div className="grid gap-3">
                  {filteredResults.map((artist: any, index: number) => (
              <div
                key={artist.id}
                onClick={() => handleSelectArtist(artist)}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-[var(--radius)] border p-4",
                  "transition-colors duration-150 hover:border-foreground/30 hover:bg-secondary/60",
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
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors overflow-hidden">
                      {artist.thumb ? (
                        <img
                          src={artist.thumb}
                          alt={artist.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Music className={`w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors ${artist.thumb ? 'hidden' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {artist.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
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
              </>
            );
          })()}
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
