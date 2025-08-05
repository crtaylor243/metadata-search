import { create } from 'zustand';

interface Release {
  id: string;
  title: string;
  year: number;
  labels?: any[];
  formats?: any[];
  country?: string;
}

interface SelectionStore {
  selectedArtist: any;
  selectedReleases: Release[];
  trackDetails: Map<string, any>;
  
  setSelectedArtist: (artist: any) => void;
  toggleRelease: (release: Release) => void;
  addTrackDetails: (releaseId: string, details: any) => void;
  clearSelection: () => void;
  getExportData: () => any;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedArtist: null,
  selectedReleases: [],
  trackDetails: new Map(),
  
  setSelectedArtist: (artist) => set({ 
    selectedArtist: artist,
    selectedReleases: [],
    trackDetails: new Map()
  }),
  
  toggleRelease: (release) => set((state) => {
    const exists = state.selectedReleases.find(r => r.id === release.id);
    if (exists) {
      const newTrackDetails = new Map(state.trackDetails);
      newTrackDetails.delete(release.id);
      return {
        selectedReleases: state.selectedReleases.filter(r => r.id !== release.id),
        trackDetails: newTrackDetails
      };
    }
    return {
      selectedReleases: [...state.selectedReleases, release]
    };
  }),
  
  addTrackDetails: (releaseId, details) => set((state) => {
    const newMap = new Map(state.trackDetails);
    newMap.set(releaseId, details);
    return { trackDetails: newMap };
  }),
  
  clearSelection: () => set({
    selectedArtist: null,
    selectedReleases: [],
    trackDetails: new Map()
  }),
  
  getExportData: () => {
    const state = get();
    return {
      artist: state.selectedArtist,
      releases: state.selectedReleases,
      trackDetails: state.trackDetails
    };
  }
}));