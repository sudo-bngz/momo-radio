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

  useEffect(() => {
    if (playlistId) {
      const loadPlaylist = async () => {
        try {
          const res = await api.getPlaylist(playlistId);
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
      setPlaylistName('New Playlist');
      setPlaylistDescription('');
      setPlaylistTracks([]);
    }
  }, [playlistId]); 

  const addTrackToPlaylist = (track: Track) => {
    if (!track || !track.id) return;
    if (!playlistTracks.find(t => String(t.id) === String(track.id))) {
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
        const oldIndex = items.findIndex((i) => String(i.id) === String(active.id));
        const newIndex = items.findIndex((i) => String(i.id) === String(over.id));
        if (oldIndex === -1 || newIndex === -1) return items;
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
        const newPlaylistRes = await api.createPlaylist({ 
          name: playlistName, 
          description: playlistDescription,
          color: '#3182ce' 
        });
        const newId = newPlaylistRes?.id;
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
    playlistId, playlistDescription, libraryTracks, playlistTracks, playlistName,
    isSaving, setPlaylistName, addTrackToPlaylist, setPlaylistDescription,
    removeTrackFromPlaylist, handleDragEnd, savePlaylist
  };
};