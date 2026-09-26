import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

export type SortOption = 'newest' | 'alphabetical' | 'duration';

const isAdvancedSearch = (query: string) => {
  if (!query) return false;
  if (query.toLowerCase().startsWith('filter:')) return true;
  const filterKeys = ['artist', 'album', 'genre', 'style', 'mood', 'scale', 'key', 'bpm', 'duration', 'year'];
  return new RegExp(`\\b(${filterKeys.join('|')})\\s*(:|>=|<=|>|<|=|!=)`, 'i').test(query);
};

export const useLibrary = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0); 
  const [searchTotal, setSearchTotal] = useState(0); 
  
  const [isLoading, setIsLoading] = useState(true); 
  const [isFetchingMore, setIsFetchingMore] = useState(false); 
  
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
      // ⚡️ RACE CONDITION FIX: If this is an advanced filter, abort the Postgres fetch
      if (isAdvancedSearch(searchQuery)) {
        if (isMounted) setIsLoading(false);
        return; 
      }

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
    // ⚡️ Abort infinite scroll via Postgres if viewing Meilisearch results
    if (isAdvancedSearch(searchQuery)) return;

    if (isFetchingMore || isLoading || tracks.length >= searchTotal) return;

    setIsFetchingMore(true);
    try {
      const response = await api.getTracks({
        limit: 100,
        offset: tracks.length, 
        search: searchQuery,
        sort: sortBy
      });
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
    isFetchingMore, 
    searchQuery,
    setSearchQuery,
    setSortBy,
    sortBy,
    loadMore,       
    hasMore         
  };
};