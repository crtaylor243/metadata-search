import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SearchHistory {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
  artistName?: string;
  artistId?: string;
}

interface HistoryStore {
  searches: SearchHistory[];
  addSearch: (search: Omit<SearchHistory, 'id' | 'timestamp'>) => void;
  removeSearch: (id: string) => void;
  clearHistory: () => void;
  getRecentSearches: (limit?: number) => SearchHistory[];
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      searches: [],
      
      addSearch: (search) => set((state) => {
        const newSearch: SearchHistory = {
          ...search,
          id: crypto.randomUUID(),
          timestamp: Date.now()
        };
        
        // Remove duplicate searches for the same artist
        const filtered = state.searches.filter(s => 
          s.artistId !== search.artistId
        );
        
        // Keep only last 50 searches
        const updated = [newSearch, ...filtered].slice(0, 50);
        return { searches: updated };
      }),
      
      removeSearch: (id) => set((state) => ({
        searches: state.searches.filter(s => s.id !== id)
      })),
      
      clearHistory: () => set({ searches: [] }),
      
      getRecentSearches: (limit = 10) => {
        return get().searches.slice(0, limit);
      }
    }),
    {
      name: 'search-history'
    }
  )
);