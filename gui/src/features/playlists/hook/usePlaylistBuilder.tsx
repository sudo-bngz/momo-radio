import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { api } from '../../../services/api';
import type { Track } from '../../../types';

export const usePlaylistBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const playlistId = id ? parseInt(id, 10) : null;

  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [playlistName, setPlaylistName] = useState('New Playlist');
  const [isSaving, setIsSaving] = useState(false);
  const [playlistDescription, setPlaylistDescription] = useState('');

  // 1. Fetch available tracks for the library
  useEffect(() => {
    let isMounted = true; 
    
    const fetchLibrary = async () => {
      try {
        const response = await api.getTracks(); 
        if (isMounted && response?.data) {
          setLibraryTracks(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error("Failed to fetch library", error);
        if (isMounted) setLibraryTracks([]); 
      }
    };

    fetchLibrary();
    return () => { isMounted = false; };
  }, []);

  // 2. MISSING PIECE ADDED: Fetch the specific playlist when in Edit Mode
  useEffect(() => {
    if (playlistId) {
      const loadPlaylist = async () => {
        try {
          const res = await api.getPlaylist(playlistId);
          // Set the name and the tracks from the database!
          setPlaylistName(res.name || 'Untitled Playlist');
          setPlaylistDescription(res.description || '');
          setPlaylistTracks(res.tracks ?? []); 
        } catch (err) {
          console.error("Failed to load playlist", err);
          setPlaylistTracks([]);
        }
      };
      loadPlaylist();
    } else {
      // If we are creating a new one, reset the form
      setPlaylistName('New Playlist');
      setPlaylistDescription('');
      setPlaylistTracks([]);
    }
  }, [playlistId]); // This runs anytime the URL ID changes

  const addTrackToPlaylist = (track: Track) => {
    const trackId = track?.id;
    if (!playlistTracks.find(t => t.id === trackId)) {
      setPlaylistTracks([...playlistTracks, track]);
    }
  };

  const removeTrackFromPlaylist = (trackId: number) => {
    setPlaylistTracks(playlistTracks.filter(t => t.id !== trackId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlaylistTracks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const savePlaylist = async (): Promise<boolean> => {
    if (playlistTracks.length === 0) return false;

    setIsSaving(true);
    try {
      const trackIds = playlistTracks.map(t => t.id);

      if (playlistId) {
        await api.updatePlaylist(playlistId, { 
          name: playlistName,
          description: playlistDescription
        });
        await api.updatePlaylistTracks(playlistId, trackIds);
      } else {
        // CREATE MODE
        const newPlaylistRes = await api.createPlaylist({ 
          name: playlistName, 
          description: playlistDescription,
          color: '#3182ce' 
        });
        
        const newId = newPlaylistRes?.id || newPlaylistRes?.id;
        if (newId) {
          await api.updatePlaylistTracks(newId, trackIds);
        }
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
    playlistId,
    playlistDescription,
    libraryTracks,
    playlistTracks,
    playlistName,
    isSaving,
    setPlaylistName,
    addTrackToPlaylist,
    setPlaylistDescription,
    removeTrackFromPlaylist,
    handleDragEnd,
    savePlaylist
  };
};