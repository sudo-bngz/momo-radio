import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import type { Track } from '../types';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  // Dynamic Layout States
  isPlayerVisible: boolean;
  setPlayerVisible: (visible: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlayerVisible, setPlayerVisible] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setPlayerVisible(true); // Always pop up when a new track is picked
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  return (
    <PlayerContext.Provider value={{ 
      currentTrack, 
      isPlaying, 
      progress, 
      playTrack, 
      togglePlayPause, 
      audioRef,
      isPlayerVisible,
      setPlayerVisible
    }}>
      {children}
      {currentTrack && (
        <audio 
          ref={audioRef} 
          src={`http://localhost:8080/api/v1/tracks/${currentTrack.id || currentTrack.id}/stream`} 
          onTimeUpdate={() => {
            if (audioRef.current) {
              setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
            }
          }}
          onEnded={() => setIsPlaying(false)}
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