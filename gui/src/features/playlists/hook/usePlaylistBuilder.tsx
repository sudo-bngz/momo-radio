import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../services/api';
import type { Track } from '../../../types';
import { useParams } from 'react-router-dom';
import { toaster } from '../../../components/ui/toaster';

export const usePlaylistBuilder = () => {
  const { id } = useParams();
  const playlistId = id ? parseInt(id, 10) : null;

  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Notice we removed the `page` state to prevent unnecessary re-renders
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ⚡️ STABILITY REFS: These track background state without triggering React re-renders!
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(1);

  // --- FETCH LIBRARY ---
  const fetchLibrary = useCallback(async (pageNum: number, search: string, isReset: boolean = false) => {
    if (isLoadingRef.current) return;
    if (!isReset && !hasMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoadingLibrary(true);
    
    try {
      const limit = 50;
      const offset = (pageNum - 1) * limit;
      
      const response = await api.getTracks({ limit, offset, search });
      const newTracks = response.data || [];

      setLibraryTracks(prev => {
        if (isReset) return newTracks;
        // Deduplication Shield
        const existingIds = new Set(prev.map(t => t.id));
        const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
        return [...prev, ...uniqueNewTracks];
      });
      
      const more = newTracks.length === limit;
      setHasMore(more);
      hasMoreRef.current = more;

    } catch (error) {
      console.error("Failed to load library tracks", error);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingLibrary(false);
    }
  }, []); 

  // --- SEARCH BAR DEBOUNCE EFFECT ---
  useEffect(() => {
    // Reset pagination states
    pageRef.current = 1;
    setHasMore(true);
    hasMoreRef.current = true;
    
    const delayDebounceFn = setTimeout(() => {
      fetchLibrary(1, searchQuery, true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchLibrary]);

  // --- INFINITE SCROLL TRIGGER ---
  const loadMore = useCallback(() => {
    if (!isLoadingRef.current && hasMoreRef.current) {
      pageRef.current += 1;
      fetchLibrary(pageRef.current, searchQuery, false);
    }
  }, [searchQuery, fetchLibrary]);

  // --- FETCH EXISTING PLAYLIST ---
  useEffect(() => {
    if (playlistId) {
      const loadPlaylist = async () => {
        try {
          const res = await api.getPlaylist(playlistId);
          setPlaylistName(res.name); 
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
    setPlaylistTracks(prev => {
      if (prev.some(t => t.id === track.id)) {
        toaster.create({
          title: "Already in playlist",
          description: "This track is already in your rotation.",
          type: "warning",
          duration: 2000,
        });
        return prev;
      }
      return [...prev, track];
    });
  };

  const removeTrackFromPlaylist = (id: number) => {
    setPlaylistTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleDragEnd = async (event: any, onAutosaveSuccess?: () => void) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = playlistTracks.findIndex(t => String(t.id) === active.id);
      const newIndex = playlistTracks.findIndex(t => String(t.id) === over.id);
      
      const newArray = [...playlistTracks];
      const [movedItem] = newArray.splice(oldIndex, 1);
      newArray.splice(newIndex, 0, movedItem);
      
      setPlaylistTracks(newArray);

      if (playlistId) {
        try {
          await api.updatePlaylistTracks(playlistId, newArray.map(t => t.id));
          if (onAutosaveSuccess) onAutosaveSuccess();
        } catch (error) {
          console.error("Autosave failed", error);
        }
      }
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
        await api.updatePlaylist(playlistId, payload);
        await api.updatePlaylistTracks(playlistId, playlistTracks.map(t => t.id));
      } else {
        const newPlaylist = await api.createPlaylist(payload);
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