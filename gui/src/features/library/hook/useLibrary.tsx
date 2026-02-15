// src/features/library/hook/useLibrary.ts
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../services/api';
import type { Track} from '../../../types'

export type SortOption = 'newest' | 'alphabetical' | 'duration';

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      try {
        const response = await api.getTracks();
        setTracks(response.data || []);
      } catch (error) {
        console.error("Failed to fetch library", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const filteredAndSortedTracks = useMemo(() => {
    let result = [...tracks];

    // Smart Search Logic
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.Title?.toLowerCase().includes(lowerQuery) || 
        t.Artist?.toLowerCase().includes(lowerQuery)
      );
    }

    // Sorting Logic
    result.sort((a, b) => {
      if (sortBy === 'alphabetical') return a.Title.localeCompare(b.Title);
      if (sortBy === 'duration') return (b.Duration || 0) - (a.Duration || 0);
      return b.ID - a.ID; // Newest first (assuming ID is incremental)
    });

    return result;
  }, [tracks, searchQuery, sortBy]);

  return {
    tracks: filteredAndSortedTracks,
    totalTracks: tracks.length,
    isLoading,
    searchQuery,
    setSearchQuery,
    setSortBy,
    sortBy
  };
};