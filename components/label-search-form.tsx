'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, X, Tag, Building, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSelectionStore } from '@/stores/selection-store';
import { useHistoryStore } from '@/stores/history-store';
import { cn } from '@/lib/utils';
import { parseDiscogsLinks } from '@/lib/discogs-links';

// Component to display recent label search as a card
function RecentLabelSearchCard({ search, onSelect, onRemove }: { search: any; onSelect: (label: any) => void; onRemove: (id: string) => void }) {
  // Fetch label details for the profile image
  const { data: labelDetails, isLoading } = useQuery({
    queryKey: ['label', search.labelId],
    queryFn: async () => {
      if (!search.labelId) return null;
      const res = await fetch(`/api/discogs/label/${search.labelId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!search.labelId
  });

  const handleClick = () => {
    // Reconstruct label object for selection
    const label = {
      id: search.labelId,
      title: search.labelName,
      type: 'label' // Default type
    };
    onSelect(label);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    onRemove(search.id);
  };

  return (
    <div 
      className="group relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-lg cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all duration-200"
      onClick={handleClick}
      title="Click to select this label"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : labelDetails?.images && labelDetails.images.length > 0 ? (
                <img
                  src={labelDetails.images[0].uri150 || labelDetails.images[0].uri}
                  alt={search.labelName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Building className={`w-7 h-7 text-primary ${labelDetails?.images && labelDetails.images.length > 0 ? 'hidden' : ''}`} />
            </div>
            <div>
              <div className="mb-1">
                <h3 className="text-xl font-bold">{search.labelName}</h3>
                {labelDetails?.parent_label && (
                  <p className="text-sm text-muted-foreground font-medium">
                    Parent: {labelDetails.parent_label.name}
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

export function LabelSearchForm() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const { selectedLabel, setSelectedLabel, clearLabelSelection } = useSelectionStore();
  const { addSearch, getRecentLabelSearches, removeSearch } = useHistoryStore();
  
  // Get recent label searches only on client-side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    setRecentSearches(getRecentLabelSearches(5));
  }, [getRecentLabelSearches]);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['label-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm) return null;
      const res = await fetch(`/api/discogs/search?q=${encodeURIComponent(searchTerm)}&type=label`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!searchTerm
  });

  // Fetch label details when label is selected
  const { data: labelDetails, isLoading: labelLoading } = useQuery({
    queryKey: ['label', selectedLabel?.id],
    queryFn: async () => {
      if (!selectedLabel?.id) return null;
      const res = await fetch(`/api/discogs/label/${selectedLabel.id}`);
      if (!res.ok) throw new Error('Failed to fetch label details');
      return res.json();
    },
    enabled: !!selectedLabel?.id
  });
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
    }
  };
  
  const handleSelectLabel = (label: any) => {
    setSelectedLabel(label);
    addSearch({
      query: searchTerm,
      resultCount: data?.results?.length || 0,
      labelName: label.title,
      labelId: label.id,
      type: 'label'
    });
  };
  
  const handleClear = () => {
    setQuery('');
    setSearchTerm('');
    clearLabelSelection();
  };
  
  return (
    <div className="space-y-6">
      {/* Search Input Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search Label</CardTitle>
            <CardDescription>
              Find record labels and view all their releases grouped by artist
            </CardDescription>
            {selectedLabel && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={clearLabelSelection}
                className="border-2 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive transition-all"
                title="Clear selection and search again"
              >
                <X className="w-4 h-4 mr-2" />
                Search for a different label
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedLabel && (
        <div className="space-y-2">
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a record label"
                className="pl-10 pr-4 h-12 text-base border-2 focus:border-primary transition-colors w-full"
              />
            </div>
            
            {/* Search Buttons */}
            <div className="flex gap-2">
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
                  Search Labels
                </>
              )}
            </Button>
            {searchTerm && (
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
        
      </div>
      )}

          {/* Selected Label Display */}
          {selectedLabel && (
            <div 
              className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-lg cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all duration-200"
              onClick={() => window.open(`https://www.discogs.com/label/${selectedLabel.id}`, '_blank')}
              title="Click to view on Discogs"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {labelLoading ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      ) : labelDetails?.images && labelDetails.images.length > 0 ? (
                        <img
                          src={labelDetails.images[0].uri150 || labelDetails.images[0].uri}
                          alt={selectedLabel.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to Building icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Building className={`w-7 h-7 text-primary ${labelDetails?.images && labelDetails.images.length > 0 ? 'hidden' : ''}`} />
                    </div>
                    <div>
                      <div className="mb-1">
                        <h3 className="text-xl font-bold">{selectedLabel.title}</h3>
                        {labelDetails?.parent_label && (
                          <p className="text-sm text-muted-foreground font-medium">
                            Parent: {labelDetails.parent_label.name}
                          </p>
                        )}
                      </div>
                      {labelDetails?.profile ? (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {parseDiscogsLinks(labelDetails.profile)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Label ID: {selectedLabel.id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State - Show in search card */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
                <div className="absolute top-0 w-16 h-16 border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">
                Searching for labels...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Label search failed. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Search Results */}
      {!selectedLabel && data?.results && (
        <div className="space-y-4">
          {(() => {
            const filteredResults = data.results;
            
            return (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Label Search Results</h3>
                  <Badge variant="secondary" className="text-sm">
                    {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
                  </Badge>
                </div>
                
                <div className="grid gap-3">
                  {filteredResults.map((label: any, index: number) => (
              <div
                key={label.id}
                onClick={() => handleSelectLabel(label)}
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
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors overflow-hidden">
                      {label.thumb ? (
                        <img
                          src={label.thumb}
                          alt={label.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Tag className={`w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors ${label.thumb ? 'hidden' : ''}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {label.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          ID: {label.id}
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
      
      {/* Recent Label Searches */}
      {!selectedLabel && !data?.results && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Label Searches</CardTitle>
            <CardDescription>
              {isMounted && recentSearches.length > 0 ? 'Click on any label to select them again' : 'Your label search history will appear here'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMounted ? (
              recentSearches.length > 0 ? (
                <div className="space-y-4">
                  {recentSearches.map((search) => (
                    <RecentLabelSearchCard 
                      key={search.id} 
                      search={search} 
                      onSelect={setSelectedLabel}
                      onRemove={removeSearch}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8">
                  <p className="text-center text-muted-foreground">
                    Search for a label to begin
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