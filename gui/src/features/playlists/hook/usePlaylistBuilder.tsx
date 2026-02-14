// src/features/playlists/hook/usePlaylistBuilder.ts
import { useState, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { api } from '../../../services/api'; // Assuming your API service is here

// Define the track type based on your Go backend
export interface Track {
  ID: number;
  Title: string;
  Artist: string;
  Duration: number;
}

export const usePlaylistBuilder = () => {
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [playlistName, setPlaylistName] = useState('New Playlist');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available tracks when component mounts
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        // Replace with your actual API call to get all tracks
        const response = await api.getTracks(); 
        setLibraryTracks(response.data);
      } catch (error) {
        console.error("Failed to fetch library", error);
      }
    };
    fetchLibrary();
  }, []);

  const addTrackToPlaylist = (track: Track) => {
    // Prevent adding the exact same instance (dnd-kit needs unique IDs)
    // If you want duplicates, you must generate a unique "instance ID" here.
    if (!playlistTracks.find(t => t.ID === track.ID)) {
      setPlaylistTracks([...playlistTracks, track]);
    }
  };

  const removeTrackFromPlaylist = (trackId: number) => {
    setPlaylistTracks(playlistTracks.filter(t => t.ID !== trackId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlaylistTracks((items) => {
        const oldIndex = items.findIndex((i) => i.ID === active.id);
        const newIndex = items.findIndex((i) => i.ID === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const savePlaylist = async () => {
    if (playlistTracks.length === 0) return;
    setIsSaving(true);
    try {
      // 1. Create the playlist container
      const newPlaylist = await api.createPlaylist({ 
        name: playlistName, 
        color: '#3182ce' 
      });
      
      // 2. Assign the tracks in their current order
      const trackIds = playlistTracks.map(t => t.ID);
      await api.updatePlaylistTracks(newPlaylist.ID, trackIds);
      
      alert('Playlist saved successfully!');
      setPlaylistTracks([]); // Clear after saving
      setPlaylistName('New Playlist');
    } catch (error) {
      console.error("Failed to save playlist", error);
      alert('Error saving playlist');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    libraryTracks,
    playlistTracks,
    playlistName,
    isSaving,
    setPlaylistName,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    handleDragEnd,
    savePlaylist
  };
};
