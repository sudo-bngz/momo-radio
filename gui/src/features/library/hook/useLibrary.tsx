import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

export type SortOption = 'newest' | 'alphabetical' | 'duration';

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0); // From /stats (1271)
  const [searchTotal, setSearchTotal] = useState(0); // From /tracks meta (helps us know when to stop)
  
  const [isLoading, setIsLoading] = useState(true); // Initial load state
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Infinite scroll state
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // 1. Fetch Global Stats (Once)
  useEffect(() => {
    api.getDashboardStats()
      .then(res => {
        if (res.stats && res.stats.total_tracks) {
          setGlobalTotal(res.stats.total_tracks);
        }
      })
      .catch(err => console.error("Stats fetch failed", err));
  }, []);

  // 2. Fetch Initial/Filtered Tracks
  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      setIsLoading(true);
      try {
        const response = await api.getTracks({
          limit: 100,
          offset: 0,
          search: searchQuery,
          sort: sortBy
        });
        if (isMounted) {
          setTracks(response.data || []);
          setSearchTotal(response.meta?.total || 0);
        }
      } catch (error) {
        console.error("Failed to fetch library", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const handler = setTimeout(fetchInitial, 300); // Debounce
    return () => {
      isMounted = false;
      clearTimeout(handler);
    };
  }, [searchQuery, sortBy]);

  // 3. Load More (Infinite Scroll)
  const loadMore = useCallback(async () => {
    // Prevent fetching if already fetching, or if we have all the tracks
    if (isFetchingMore || isLoading || tracks.length >= searchTotal) return;

    setIsFetchingMore(true);
    try {
      const response = await api.getTracks({
        limit: 100,
        offset: tracks.length, // Start from where we left off
        search: searchQuery,
        sort: sortBy
      });
      // Append new tracks to the existing list
      setTracks(prev => [...prev, ...(response.data || [])]);
    } catch (error) {
      console.error("Failed to fetch more tracks", error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, isLoading, tracks.length, searchTotal, searchQuery, sortBy]);

  const hasMore = tracks.length < searchTotal;

  return {
    tracks,
    setTracks,
    globalTotal,
    isLoading,
    isFetchingMore, // Exported to show a spinner at the bottom
    searchQuery,
    setSearchQuery,
    setSortBy,
    sortBy,
    loadMore,       // Exported to trigger on scroll
    hasMore         // Exported to know when to stop
  };
};