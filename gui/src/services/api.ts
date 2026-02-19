import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore'; // We will create this next
import type { 
  AnalyzeResponse, 
  TrackMetadata, 
  Track, 
  Playlist, 
  ScheduleSlot,
  DashboardData
} from '../types';

const API_URL = 'http://localhost:8081/api/v1';

// Create a dedicated Axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.token;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('API Request: Token attached');
  } else {
    console.warn('API Request: No token found in store');
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * GLOBAL API METHODS
 */
export const api = {
  // 1. INGESTION & UPLOAD
  analyzeFile: async (file: File): Promise<AnalyzeResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<AnalyzeResponse>('/upload/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  uploadTrack: async (file: File, metadata: TrackMetadata): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    
    (Object.keys(metadata) as Array<keyof TrackMetadata>).forEach((key) => {
      formData.append(key, (metadata as any)[key]);
    });

    await apiClient.post('/upload/confirm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // 2. LIBRARY MANAGEMENT
  getTracks: async (): Promise<{ data: Track[] }> => {
    const response = await apiClient.get<{ data: Track[] }>('/tracks');
    return response.data;
  },

  // 3. PLAYLIST BUILDER
  createPlaylist: async (data: { name: string; description: string, color?: string }): Promise<Playlist> => {
    const response = await apiClient.post<Playlist>('/playlists', data);
    return response.data;
  },

  getPlaylists: async (): Promise<{ data: Playlist[] }> => {
    const response = await apiClient.get<{ data: Playlist[] }>('/playlists');
    return response.data;
  },

  getPlaylist: async (playlistId: number): Promise<Playlist> => {
    const response = await apiClient.get<Playlist>(`/playlists/${playlistId}`);
    return response.data;
  },

  updatePlaylist: async (
    playlistId: number, 
    data: { name?: string; description?: string; color?: string }
  ): Promise<void> => {
    await apiClient.put(`/playlists/${playlistId}`, data);
  },
  updatePlaylistTracks: async (playlistId: number, trackIds: number[]): Promise<void> => {
    await apiClient.put(`/playlists/${playlistId}/tracks`, { track_ids: trackIds });
  },

  deletePlaylist: async (playlistId: number): Promise<void> => {
    await apiClient.delete(`/playlists/${playlistId}`);
  },

  // 4. SCHEDULER
  getSchedule: async (start: string, end: string): Promise<ScheduleSlot[]> => {
    const response = await apiClient.get<ScheduleSlot[]>('/schedules', {
      params: { start, end }
    });
    return response.data;
  },

  createScheduleSlot: async (playlistId: number, startTime: string): Promise<ScheduleSlot> => {
    const response = await apiClient.post<ScheduleSlot>('/schedules', {
      playlist_id: playlistId,
      start_time: startTime
    });
    return response.data;
  },

  deleteScheduleSlot: async (slotId: number): Promise<void> => {
    await apiClient.delete(`/schedules/${slotId}`);
  },

  // 5. DASHBOARD STATS
  getDashboardStats: async (): Promise<DashboardData> => {
    const response = await apiClient.get<DashboardData>('/stats');
    return response.data;
  }
};