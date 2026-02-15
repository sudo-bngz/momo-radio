import axios from 'axios';
import type { 
  AnalyzeResponse, 
  TrackMetadata, 
  Track, 
  Playlist, 
  ScheduleSlot,
  DashboardData
} from '../types';

const API_URL = 'http://localhost:8081/api/v1';

export const api = {
  // ---------------------------------------------------------
  // 1. INGESTION & UPLOAD 
  // ---------------------------------------------------------
  
  analyzeFile: async (file: File): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post<AnalyzeResponse>(`${API_URL}/upload/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

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

  getTracks: async (): Promise<{ data: Track[] }> => {
    const response = await axios.get<{ data: Track[] }>(`${API_URL}/tracks`);
    return response.data;
  },

  // ---------------------------------------------------------
  // 3. PLAYLIST BUILDER
  // ---------------------------------------------------------

  createPlaylist: async (data: { name: string; color: string }): Promise<Playlist> => {
    const response = await axios.post<Playlist>(`${API_URL}/playlists`, data);
    return response.data;
  },

  getPlaylists: async (): Promise<{ data: Playlist[] }> => {
    const response = await axios.get<{ data: Playlist[] }>(`${API_URL}/playlists`);
    return response.data;
  },

  updatePlaylistTracks: async (playlistId: number, trackIds: number[]): Promise<void> => {
    await axios.put(`${API_URL}/playlists/${playlistId}/tracks`, { track_ids: trackIds });
  },

  // ---------------------------------------------------------
  // 4. SCHEDULER (CALENDAR)
  // ---------------------------------------------------------

  getSchedule: async (start: string, end: string): Promise<ScheduleSlot[]> => {
    const response = await axios.get<ScheduleSlot[]>(`${API_URL}/schedule`, {
      params: { start, end }
    });
    return response.data;
  },

  createScheduleSlot: async (playlistId: number, startTime: string): Promise<ScheduleSlot> => {
    const response = await axios.post<ScheduleSlot>(`${API_URL}/schedule`, {
      playlist_id: playlistId,
      start_time: startTime
    });
    return response.data;
  },

  deleteScheduleSlot: async (slotId: number): Promise<void> => {
    await axios.delete(`${API_URL}/schedule/${slotId}`);
  },

  // ---------------------------------------------------------
  // 5. STATION STATS (DASHBOARD)
  // ---------------------------------------------------------

  /**
   * Fetches the aggregated station data for the Dashboard.
   * Maps to the Go backend's /stats endpoint.
   */
  getDashboardStats: async (): Promise<DashboardData> => {
    const response = await axios.get<DashboardData>(`${API_URL}/stats`);
    return response.data;
  }
};