import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Playlist } from '../../../types';
import type { EventInput } from '@fullcalendar/core';

// Helper to map your Go backend days to FullCalendar's integer days
const dayMap: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
};

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

  // 2. Fetch the schedule for the current calendar view
  const fetchSchedule = useCallback(async (startStr: string, endStr: string) => {
    setIsLoading(true);
    try {
      const slots = await api.getSchedule(startStr, endStr);
      
      const formattedEvents: EventInput[] = slots.map((slot: any) => {
        const isRecurring = slot.schedule_type === 'recurring';
        
        // Base event properties
        const event: EventInput = {
          id: slot.id.toString(),
          title: slot.playlist?.name || 'Unknown Playlist',
          backgroundColor: slot.playlist?.color || '#3182ce',
          borderColor: slot.playlist?.color || '#3182ce',
          extendedProps: { 
            playlistId: slot.playlist_id,
            scheduleType: slot.schedule_type 
          }
        };

        if (isRecurring && slot.days) {
          // --- RECURRING EVENT (Weekly Show) ---
          // FullCalendar uses daysOfWeek (e.g., [0, 2] for Sun, Tue)
          // and startTime/endTime (e.g., "09:00:00") for repeating blocks
          event.daysOfWeek = slot.days.split(',').map((d: string) => dayMap[d.trim()]);
          event.startTime = `${slot.start_time}:00`;
          event.endTime = `${slot.end_time}:00`;
        } else {
          // --- ONE-TIME EVENT (Special Guest Mix) ---
          event.start = `${slot.date}T${slot.start_time}:00`;
          event.end = `${slot.date}T${slot.end_time}:00`;
        }

        return event;
      });
      
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Failed to fetch schedule", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 3. Handle dropping a playlist onto the calendar grid
  const handleEventReceive = async (info: any) => {
    const playlistId = parseInt(info.event.extendedProps.playlistId, 10);
    // This sends UTC time to Go. Thanks to our new Go Timezone config, 
    // Go will translate this UTC time back into your local Paris time flawlessly!
    const startTime = info.event.start.toISOString();

    try {
      await api.createScheduleSlot(playlistId, startTime);
      info.revert(); 
      fetchSchedule(info.view.activeStart.toISOString(), info.view.activeEnd.toISOString());
    } catch (error) {
      console.error("Failed to schedule playlist", error);
      info.revert(); 
      alert("Could not schedule playlist. Check for overlaps or server issues.");
    }
  };

  // 4. Handle deleting a scheduled slot by clicking it
  const handleEventClick = async (info: any) => {
    if (window.confirm(`Remove '${info.event.title}' from the schedule?`)) {
      try {
        await api.deleteScheduleSlot(parseInt(info.event.id, 10));
        info.event.remove(); 
      } catch (error) {
        console.error("Failed to delete slot", error);
        alert("Could not delete the scheduled slot.");
      }
    }
  };

  const handleManualSchedule = async (playlistId: number, date: string, time: string) => {
    try {
      const startDateTime = new Date(`${date}T${time}:00`).toISOString();
      await api.createScheduleSlot(playlistId, startDateTime);
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