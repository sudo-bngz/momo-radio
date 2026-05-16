import { create } from 'zustand';

interface SearchState {
  globalSearch: string;
  setGlobalSearch: (query: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  globalSearch: '',
  setGlobalSearch: (query) => set({ globalSearch: query }),
}));
