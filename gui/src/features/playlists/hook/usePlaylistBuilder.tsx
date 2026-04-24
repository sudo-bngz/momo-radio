import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';
import { useParams } from 'react-router-dom';

export const usePlaylistBuilder = () => {
  const { id } = useParams();
  const playlistId = id ? parseInt(id, 10) : null;

  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- FETCH LIBRARY
  const fetchLibrary = useCallback(async (pageNum: number, search: string, reset: boolean = false) => {
    if (isLoadingLibrary || (!hasMore && !reset)) return;
    setIsLoadingLibrary(true);
    
    try {
      const limit = 50;
      const offset = (pageNum - 1) * limit;
      
      // ⚡️ FIXED: Passed as an object { limit, offset, search } instead of 3 arguments
      const response = await api.getTracks({ limit, offset, search });
      const newTracks = response.data || [];

      if (reset) {
        setLibraryTracks(newTracks);
      } else {
        setLibraryTracks(prev => [...prev, ...newTracks]);
      }
      
      setHasMore(newTracks.length === limit);
    } catch (error) {
      console.error("Failed to load library tracks", error);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [hasMore, isLoadingLibrary]);

  // Initial Load & Search Trigger
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    
    const delayDebounceFn = setTimeout(() => {
      fetchLibrary(1, searchQuery, true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchLibrary]);

  // Load More Trigger
  const loadMore = () => {
    if (hasMore && !isLoadingLibrary) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLibrary(nextPage, searchQuery, false);
    }
  };

  // --- FETCH EXISTING PLAYLIST ---
  useEffect(() => {
    if (playlistId) {
      const loadPlaylist = async () => {
        try {
          const res = await api.getPlaylist(playlistId);
          setPlaylistName(res.name); // ⚡️ Accessing directly based on your getPlaylist API return type
          setPlaylistDescription(res.description || '');
          setPlaylistTracks(res.tracks || []);
        } catch (error) {
          console.error("Failed to load playlist", error);
        }
      };
      loadPlaylist();
    }
  }, [playlistId]);

  // --- ACTIONS ---
  const addTrackToPlaylist = (track: Track) => {
    setPlaylistTracks(prev => [...prev, track]);
  };

  const removeTrackFromPlaylist = (id: number) => {
    setPlaylistTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = playlistTracks.findIndex(t => String(t.id) === active.id);
      const newIndex = playlistTracks.findIndex(t => String(t.id) === over.id);
      
      const newArray = [...playlistTracks];
      const [movedItem] = newArray.splice(oldIndex, 1);
      newArray.splice(newIndex, 0, movedItem);
      
      setPlaylistTracks(newArray);
    }
  };

  const savePlaylist = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: playlistName,
        description: playlistDescription,
      };

      if (playlistId) {
        // Update basic info
        await api.updatePlaylist(playlistId, payload);
        // Update tracks array
        await api.updatePlaylistTracks(playlistId, playlistTracks.map(t => t.id));
      } else {
        // Create new playlist
        const newPlaylist = await api.createPlaylist(payload);
        // Link the tracks to the newly created playlist
        await api.updatePlaylistTracks(newPlaylist.id, playlistTracks.map(t => t.id));
      }
      return true;
    } catch (error) {
      console.error("Failed to save playlist", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    libraryTracks,
    playlistTracks,
    playlistName,
    playlistDescription,
    searchQuery,
    setSearchQuery,
    loadMore,
    hasMore,
    isLoadingLibrary,
    isSaving,
    setPlaylistName,
    setPlaylistDescription,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    handleDragEnd,
    savePlaylist,
    playlistId
  };
};