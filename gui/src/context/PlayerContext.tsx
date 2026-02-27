import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { Track } from '../types';

const API_BASE_URL = "/api/v1";

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  // Updated: Now accepts an optional playlist (queue)
  playTrack: (track: Track, playlist?: Track[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlayerVisible: boolean;
  setPlayerVisible: (visible: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]); // NEW: Holds the list of songs
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isPlayerVisible, setPlayerVisible] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const token = useAuthStore((state) => state.token);

  // Updated playTrack: accepts the list of tracks context
  const playTrack = (track: Track, playlist: Track[] = []) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlayerVisible(true);
      // If a playlist is passed, update the queue. 
      // If not, keep the existing queue (or create a queue of 1).
      if (playlist.length > 0) {
        setQueue(playlist);
      } else if (queue.length === 0) {
        setQueue([track]); 
      }
    }
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;
    setIsPlaying(!isPlaying);
  };

  // NEW: Next Track Logic
  const playNext = () => {
    if (!currentTrack || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    // If there is a next song, play it
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    } else {
      // Optional: Loop back to start? Or stop.
      setIsPlaying(false);
    }
  };

  // NEW: Previous Track Logic
  const playPrevious = () => {
    if (!currentTrack || queue.length === 0) return;
    
    // If we are more than 2 seconds in, just restart the song (Spotify behavior)
    if (audioRef.current && audioRef.current.currentTime > 2) {
      audioRef.current.currentTime = 0;
      return;
    }

    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    }
  };

  // Sync Play/Pause
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      const p = audioRef.current.play();
      if (p !== undefined) p.catch(() => console.log("Waiting for user interaction"));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]); // Added currentTrack dependency

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Handle auto-play next track when song ends
  const handleEnded = () => {
    playNext();
  };

  const trackId = currentTrack?.id || (currentTrack as any)?.ID;

  return (
    <PlayerContext.Provider value={{ 
      currentTrack, isPlaying, progress, playTrack, togglePlayPause, 
      playNext, playPrevious, // Export these
      audioRef, isPlayerVisible, setPlayerVisible, volume, setVolume
    }}>
      {children}
      
      {currentTrack && trackId && (
        <audio 
          key={trackId}
          ref={audioRef}
          src={`${API_BASE_URL}/tracks/${trackId}/stream?token=${token}`}
          crossOrigin="anonymous"
          autoPlay 
          onEnded={handleEnded} // Auto-play next
          onTimeUpdate={() => {
            if (audioRef.current) {
              const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
              setProgress(isNaN(p) ? 0 : p);
            }
          }}
        />
      )}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};