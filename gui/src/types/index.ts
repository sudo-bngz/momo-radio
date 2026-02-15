// src/types/index.ts

// src/types/index.ts
export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  label: string; 
  catalog_number: string;
  country: string;
  style: string;
}

export interface AnalyzeResponse {
  filename: string;
  format: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  bpm: string;
  key: string;
}

export type UploadStatus = 
  | 'idle' 
  | 'analyzing' 
  | 'review' 
  | 'uploading' 
  | 'success' 
  | 'error';

export interface Track {
  ID: number;
  Title: string;
  Artist: string;
  Duration: number;
}

export interface Playlist {
  ID: number;
  name: string;           // Changed from Name
  color: string;          // Changed from Color
  total_duration: number; // Changed from TotalDuration
}

export interface ScheduleSlot {
  ID: number;
  playlist_id: number;
  playlist: Playlist;
  start_time: string;
  end_time: string;
}

/**
 * Represents the aggregated data returned by the /stats endpoint
 * for the Dashboard view.
 */
export interface DashboardData {
  stats: {
    total_tracks: number;
    total_playlists: number;
    storage_used_bytes: number;
    uptime: string;
  };
  now_playing: NowPlayingInfo | null;
  recent_tracks: Track[];
}

/**
 * Details about the currently broadcasting track
 */
export interface NowPlayingInfo {
  title: string;
  artist: string;
  playlist_name: string;
  starts_at: string; // ISO Date string from Go time.Time
  ends_at: string;   // ISO Date string from Go time.Time
}

/**
 * Existing Track interface (ensure it matches your DB columns)
 */
export interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration: number; // in seconds
  created_at: string;
  // ... other fields like label, country, etc.
}
