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
  // --- Base / GORM Fields ---
  id: number;
  created_at?: string;
  updated_at?: string;

  // --- Core Identifiers ---
  key: string; // The S3/B2 storage key

  // --- Core Metadata ---
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  style?: string;
  year?: string;
  publisher?: string;
  release_country?: string;
  artist_country?: string;

  // --- Technical Details ---
  duration: number; // in seconds
  bitrate?: number;
  format?: string;
  file_size?: number;

  // --- Acoustic Features ---
  bpm?: number;
  musical_key?: string; // JSON maps "MusicalKey" to "musical_key"
  scale?: string;
  danceability?: number;
  loudness?: number;
  energy?: number;

  // --- Extended Tags ---
  catalog_number?: string;
  mood?: string;

  // --- Radio Logic & Stats ---
  play_count?: number;
  last_played?: string | null; // Will be an ISO date string when populated
}

// Lightweight version for the massive virtualized table
export type LibraryTrack = Pick<Track, 'id' | 'title' | 'artist' | 'duration'>;
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
