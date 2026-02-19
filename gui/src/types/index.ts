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

/**
 * Single Track definition (unified version)
 */
export interface Track {
  id: number;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration: number; // in seconds
  created_at?: string;
}

/**
 * Playlist definition including its tracks
 */
export interface Playlist {
  id: number;
  name: string;
  description: string;
  color: string;
  total_duration: number; 
  tracks?: Track[]; // Optional because it might not be loaded in the list view
}

export interface ScheduleSlot {
  id: number;
  playlist_id: number;
  playlist: Playlist;
  start_time: string;
  end_time: string;
}

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

export interface NowPlayingInfo {
  title: string;
  artist: string;
  playlist_name: string;
  starts_at: string; 
  ends_at: string;   
}

export interface User {
  id: number;
  username: string;
  email?: string; // Optional depending on your Go model
  role: 'admin' | 'manager' | 'viewer'; // Enforce specific roles
  created_at?: string;
}

export interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>; 
  isPlayerVisible: boolean;
  setPlayerVisible: (visible: boolean) => void;
}
