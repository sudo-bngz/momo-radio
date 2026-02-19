import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Playlist } from '../../../types';
import type { EventInput } from '@fullcalendar/core';

export const useSchedule = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch playlists for the draggable sidebar
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const res = await api.getPlaylists();
        setPlaylists(res.data);
      } catch (error) {
        console.error("Failed to fetch playlists", error);
      }
    };
    fetchPlaylists();
  }, []);

  // 2. Fetch the schedule for the current calendar view (Week/Month)
  const fetchSchedule = useCallback(async (startStr: string, endStr: string) => {
    setIsLoading(true);
    try {
      const slots = await api.getSchedule(startStr, endStr);
      
      // Map Go ScheduleSlots to FullCalendar Event objects.
      // We use the lowercase keys (playlist, name, start_time) to match 
      // the JSON response from your Go backend exactly.
      const formattedEvents: EventInput[] = slots.map((slot: any) => ({
        id: slot.id.toString(),
        title: slot.playlist?.name || 'Unknown Playlist',
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: slot.playlist?.color || '#3182ce',
        borderColor: slot.playlist?.color || '#3182ce',
        extendedProps: { playlistId: slot.playlist_id }
      }));
      
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Failed to fetch schedule", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3. Handle dropping a playlist onto the calendar grid
  const handleEventReceive = async (info: any) => {
    // Extract data from the dropped "ghost" event
    const playlistId = parseInt(info.event.extendedProps.playlistId, 10);
    const startTime = info.event.start.toISOString();

    try {
      // Send the placement to the Go backend
      await api.createScheduleSlot(playlistId, startTime);
      
      // Revert removes the fake HTML node FullCalendar drew during the drag.
      info.revert(); 
      
      // Re-fetch the schedule to get the REAL block from the database,
      // which will now have the accurately calculated end_time!
      fetchSchedule(info.view.activeStart.toISOString(), info.view.activeEnd.toISOString());
    } catch (error) {
      console.error("Failed to schedule playlist", error);
      info.revert(); // Undo the drag if the API call failed
      alert("Could not schedule playlist. Check for overlaps or server issues.");
    }
  };

  // 4. Handle deleting a scheduled slot by clicking it
  const handleEventClick = async (info: any) => {
    if (window.confirm(`Remove '${info.event.title}' from the schedule?`)) {
      try {
        // info.event.id maps directly to the Go ScheduleSlot ID
        await api.deleteScheduleSlot(parseInt(info.event.id, 10));
        
        // Instantly remove it from the UI for a snappy experience
        info.event.remove(); 
      } catch (error) {
        console.error("Failed to delete slot", error);
        alert("Could not delete the scheduled slot.");
      }
    }
  };

  const handleManualSchedule = async (playlistId: number, date: string, time: string) => {
    try {
      // Combine date "YYYY-MM-DD" and time "HH:MM" into a proper ISO string
      const startDateTime = new Date(`${date}T${time}:00`).toISOString();
      
      await api.createScheduleSlot(playlistId, startDateTime);
      
      // Refresh the calendar view
      // We force a refresh by fetching the current month/week again.
      // A quick hack is to just reload the page, or you can manage the current date state.
      window.location.reload(); 
    } catch (error) {
      console.error("Failed to schedule playlist", error);
      alert("Could not schedule playlist.");
    }
  };

  return {
    playlists,
    events,
    isLoading,
    fetchSchedule,
    handleEventReceive,
    handleEventClick,
    handleManualSchedule
  };
};