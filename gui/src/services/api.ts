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

export const apiClient = axios.create({
  baseURL: API_URL,
});

/**
 * ⚡️ MULTI-TENANT REQUEST INTERCEPTOR
 * Aggressively attaches the Organization ID to Headers, Query Params, JSON Bodies, and FormData.
 */
apiClient.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.session?.access_token;
  const orgId = state.activeOrganizationId;
  
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (orgId) {
    // 1. ALWAYS attach to Headers
    if (config.headers) {
      config.headers['X-Organization-Id'] = orgId;
    }

    // 2. ALWAYS inject into Query Params (Great for GET lists like /tracks and /playlists)
    config.params = {
      ...config.params,
      org_id: orgId,
    };

    // 3. Inject into FormData (For audio file uploads)
    if (config.data instanceof FormData) {
      if (!config.data.has('organization_id')) {
        config.data.append('organization_id', orgId);
      }
    } 
    // 4. Inject into standard JSON POST/PUT bodies (For creating playlists/metadata)
    else if (
      config.data && 
      typeof config.data === 'object' && 
      ['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')
    ) {
      config.data = {
        ...config.data,
        organization_id: orgId,
      };
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * RESPONSE INTERCEPTOR
 * Intercepts 401 Unauthorized errors to trigger the modal.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or unauthorized. Triggering re-login.');
      useAuthStore.getState().setSessionExpired(true);
    }
    return Promise.reject(error);
  }
);

/**
 * GLOBAL API METHODS
 * (Notice how clean these stay! The interceptor does all the heavy lifting.)
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