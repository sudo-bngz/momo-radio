import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import type { 
  AnalyzeResponse, 
  TrackMetadata, 
  Track, 
  Playlist, 
  ScheduleSlot,
  DashboardData
} from '../types';

const API_URL = '/api/v1';

// Create a dedicated Axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
});

/**
 * REQUEST INTERCEPTOR
 * Attaches the JWT token to every request if it exists in the store.
 */
apiClient.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.token;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * RESPONSE INTERCEPTOR
 * Intercepts 401 Unauthorized errors to trigger the logout/session-expired modal.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returns 401, the JWT is either expired or invalid
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or unauthorized. Triggering re-login.');
      useAuthStore.getState().setSessionExpired(true);
    }
    return Promise.reject(error);
  }
);

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

  // ⚡️ UPDATED: Now returns the data so useIngest can grab the track_id for the SSE stream!
  uploadTrack: async (file: File, metadata: TrackMetadata): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    
    (Object.keys(metadata) as Array<keyof TrackMetadata>).forEach((key) => {
      formData.append(key, (metadata as any)[key]);
    });

    const response = await apiClient.post('/upload/confirm', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Fetch the live processing queue
  getQueue: async (): Promise<any[]> => {
    const response = await apiClient.get('/tracks/queue');
    return response.data;
  },

  // 2. LIBRARY MANAGEMENT
  getTracks: async (params?: { 
    limit?: number; 
    offset?: number; 
    search?: string; 
    sort?: string 
  }): Promise<{ data: Track[], meta: { total: number, limit: number, offset: number } }> => {
    const response = await apiClient.get('/tracks', { params });
    return response.data;
  },

  getTrack: async (id: number | string): Promise<Track> => {
    const response = await apiClient.get<Track>(`/tracks/${id}`);
    return response.data;
  },

  updateTrack: async (id: number | string, data: Partial<Track>): Promise<void> => {
    await apiClient.put(`/tracks/${id}`, data);
  },

  analysis: async (id: number | string): Promise<void> => {
    await apiClient.post(`/tracks/${id}/analysis`);
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

  exportToRekordbox: async (playlistId: number): Promise<{ message: string, task_id: string }> => {
    const response = await apiClient.post(`/playlists/${playlistId}/export/rekordbox`);
    return response.data;
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
  },
};