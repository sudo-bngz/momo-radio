import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

export type SortOption = 'newest' | 'alphabetical' | 'duration';

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Load the global count once
  useEffect(() => {
    api.getDashboardStats().then(data => {
      setGlobalTotal(data.stats.total_tracks);
    }).catch(err => console.error(err));
  }, []);

  // Load the tracks (limiting to 100 for now to keep it fast)
  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      try {
        const response = await api.getTracks({
          limit: 100, 
          search: searchQuery,
          sort: sortBy
        });
        setTracks(response.data || []);
      } catch (error) {
        console.error("Failed to fetch library", error);
      } finally {
        setIsLoading(false);
      }
    };

    const handler = setTimeout(fetchLibrary, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, sortBy]);

  return {
    tracks,
    setTracks,
    globalTotal, // ⚡️ This is your 1271
    isLoading,
    searchQuery,
    setSearchQuery,
    setSortBy,
    sortBy
  };
};