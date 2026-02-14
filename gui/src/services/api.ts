// src/services/api.ts
import axios from 'axios';
import type { AnalyzeResponse, TrackMetadata } from '../types';

// Depending on your types.ts file, you might want to move these interfaces there.
export interface Track {
  ID: number;
  Title: string;
  Artist: string;
  Duration: number;
}

export interface Playlist {
  ID: number;
  Name: string;
  Color: string;
  TotalDuration: number;
}

export interface ScheduleSlot {
  ID: number;
  PlaylistID: number;
  StartTime: string;
  EndTime: string;
}

const API_URL = 'http://localhost:8081/api/v1';

export const api = {
  // ---------------------------------------------------------
  // 1. INGESTION & UPLOAD 
  // ---------------------------------------------------------
  
  /**
   * Sends the file to the server for ID3 tag extraction.
   * Does not save the file to DB/S3 yet.
   */
  analyzeFile: async (file: File): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post<AnalyzeResponse>(`${API_URL}/upload/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Uploads the file and the user-confirmed metadata to the server.
   * Triggers the DB insert and S3 upload.
   */
  uploadTrack: async (file: File, metadata: TrackMetadata): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    
    (Object.keys(metadata) as Array<keyof TrackMetadata>).forEach((key) => {
      formData.append(key, metadata[key]);
    });

    await axios.post(`${API_URL}/upload/confirm`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // ---------------------------------------------------------
  // 2. LIBRARY MANAGEMENT
  // ---------------------------------------------------------

  /**
   * Fetches the entire library of processed tracks.
   * Expected Go backend response: { "data": [ { ...Track }, ... ] }
   */
  getTracks: async (): Promise<{ data: Track[] }> => {
    // 
    const response = await axios.get<{ data: Track[] }>(`${API_URL}/tracks`);
    return response.data;
  },

  // ---------------------------------------------------------
  // 3. PLAYLIST BUILDER
  // ---------------------------------------------------------

  /**
   * Creates an empty playlist container.
   */
  createPlaylist: async (data: { name: string; color: string }): Promise<Playlist> => {
    const response = await axios.post<Playlist>(`${API_URL}/playlists`, data);
    return response.data;
  },

  /**
   * Fetches all playlists (useful for the calendar sidebar).
   */
  getPlaylists: async (): Promise<{ data: Playlist[] }> => {
    const response = await axios.get<{ data: Playlist[] }>(`${API_URL}/playlists`);
    return response.data;
  },

  /**
   * Replaces the tracks inside a playlist and updates the sort order.
   */
  updatePlaylistTracks: async (playlistId: number, trackIds: number[]): Promise<void> => {
    await axios.put(`${API_URL}/playlists/${playlistId}/tracks`, { track_ids: trackIds });
  },

  // ---------------------------------------------------------
  // 4. SCHEDULER (CALENDAR)
  // ---------------------------------------------------------

  /**
   * Fetches scheduled events for a specific date range.
   */
  getSchedule: async (start: string, end: string): Promise<ScheduleSlot[]> => {
    const response = await axios.get<ScheduleSlot[]>(`${API_URL}/schedule`, {
      params: { start, end }
    });
    return response.data;
  },

  /**
   * Assigns a playlist to a specific start time on the calendar.
   */
  createScheduleSlot: async (playlistId: number, startTime: string): Promise<ScheduleSlot> => {
    const response = await axios.post<ScheduleSlot>(`${API_URL}/schedule`, {
      playlist_id: playlistId,
      start_time: startTime
    });
    return response.data;
  },

  /**
   * Removes a scheduled slot from the calendar.
   */
  deleteScheduleSlot: async (slotId: number): Promise<void> => {
    await axios.delete(`${API_URL}/schedule/${slotId}`);
  }
};