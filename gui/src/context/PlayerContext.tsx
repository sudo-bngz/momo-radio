import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';
import type { Track } from '../types';

const API_BASE_URL = "/api/v1";
const FFMPEG_CHUNK_SEC = 4; // Matches radio.segment_time in your Go config

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  liveMeta: any;
  liveElapsed: number;
  liveDuration: number;
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
  const [queue, setQueue] = useState<Track[]>([]); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isPlayerVisible, setPlayerVisible] = useState(false);
  
  // --- States strictly for UI Rendering ---
  const [liveMeta, setLiveMeta] = useState<any>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveDuration, setLiveDuration] = useState(0);

  // --- Refs for High-Performance Ticker ---
  const liveTitleRef = useRef<string | null>(null);
  const pendingTitleRef = useRef<string | null>(null);
  const pendingMetaRef = useRef<any>(null);
  const liveDurationRef = useRef<number>(0);
  const localStartTimeRef = useRef<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const token = useAuthStore((state: any) => state.session?.access_token || state.token);
  const activeOrgId = useAuthStore((state: any) => state.activeOrganizationId);

  const trackId = String(currentTrack?.id || '');
  const directUrl = String((currentTrack as any)?.url || (currentTrack as any)?.stream_url || ''); 
  const audioSrc = directUrl ? directUrl : `${API_BASE_URL}/tracks/${trackId}/stream?token=${token}&org_id=${activeOrgId}`;
  
  const isLiveStream = trackId.startsWith('live') || trackId === 'radio' || audioSrc.includes('.m3u8');

  // ⚡️ DYNAMIC LATENCY ENGINE
  const getDynamicLatencyMs = () => {
    // If HLS isn't running yet, fallback to a safe 15s default
    if (!hlsRef.current || isNaN(hlsRef.current.latency)) return 15000; 
    
    // hls.latency = Time between current playhead and the live edge of the playlist.
    // + FFMPEG_CHUNK_SEC = Time it took the server to generate that live edge.
    return (hlsRef.current.latency + FFMPEG_CHUNK_SEC) * 1000;
  };

  // 1. POLL THE BACKEND
  useEffect(() => {
    if (!isLiveStream || !isPlaying) {
      setLiveMeta(null);
      liveTitleRef.current = null;
      pendingMetaRef.current = null;
      return;
    }

    const fetchStats = async () => {
      try {
        const stats = await api.getDashboardStats();
        if (!stats?.now_playing) return;
        
        const serverMeta = stats.now_playing;
        const serverElapsed = serverMeta.elapsed_ms || 0;
        const durationSec = (serverMeta.duration_ms || 0) / 1000;
        
        // ⚡️ Fetch exact real-time latency for this specific listener
        const currentLatencyMs = getDynamicLatencyMs();
        
        // A. VERY FIRST LOAD
        if (!liveTitleRef.current) {
            liveTitleRef.current = serverMeta.title;
            liveDurationRef.current = durationSec;
            // Sync clock, subtracting the dynamic latency
            localStartTimeRef.current = Date.now() - (serverElapsed - currentLatencyMs);
            
            setLiveMeta(serverMeta);
            setLiveDuration(durationSec);
            return;
        }
        
        // B. TRACK CHANGED ON SERVER (Queue it in the buffer!)
        if (serverMeta.title !== liveTitleRef.current && serverMeta.title !== pendingTitleRef.current) {
            pendingTitleRef.current = serverMeta.title;
            pendingMetaRef.current = {
                ...serverMeta,
                switchAt: Date.now() + currentLatencyMs // ⚡️ Wait exactly the dynamic latency duration before switching UI
            };
        }
        
        // C. SAME TRACK ONGOING (Refine the clock sync to prevent drift)
        if (serverMeta.title === liveTitleRef.current) {
            localStartTimeRef.current = Date.now() - (serverElapsed - currentLatencyMs);
            liveDurationRef.current = durationSec;
            setLiveDuration(durationSec);
        }
      } catch (err) {
        console.warn("Failed to fetch live stats:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); 
    return () => clearInterval(interval);
  }, [isLiveStream, isPlaying]);

  // 2. THE VISUAL TICKER ENGINE
  useEffect(() => {
    if (!isLiveStream) return;

    const ticker = setInterval(() => {
        const now = Date.now();
        const pending = pendingMetaRef.current;

        // --- EXECUTE THE DELAYED TRACK SWITCH ---
        if (pending && now >= pending.switchAt) {
            liveTitleRef.current = pending.title;
            liveDurationRef.current = (pending.duration_ms || 0) / 1000;
            
            localStartTimeRef.current = now;
            
            setLiveMeta(pending);
            setLiveDuration(liveDurationRef.current);
            
            pendingTitleRef.current = null;
            pendingMetaRef.current = null;
            
            setProgress(0);
            setLiveElapsed(0);
            return; 
        }

        // --- TICK THE CURRENT TRACK ---
        if (localStartTimeRef.current !== null && liveDurationRef.current > 0) {
            let currentElapsedMs = now - localStartTimeRef.current;
            
            if (currentElapsedMs < 0) currentElapsedMs = 0; 
            
            const pct = (currentElapsedMs / (liveDurationRef.current * 1000)) * 100;
            const safePct = Math.min(100, Math.max(0, pct));
            
            setProgress(isNaN(safePct) ? 0 : safePct);
            setLiveElapsed(currentElapsedMs / 1000);
        }
    }, 1000);

    return () => clearInterval(ticker);
  }, [isLiveStream]);

  // 3. AUDIO ENGINE & HLS.JS
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    audio.src = '';

    if (isLiveStream && Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        maxLiveSyncPlaybackRate: 1.2,
        enableWorker: true
      });
      hlsRef.current = hls;
      hls.loadSource(audioSrc);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isPlaying) audio.play().catch(() => {});
      });
    } else {
      audio.src = audioSrc;
      if (isPlaying) audio.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [audioSrc, currentTrack, isLiveStream, isPlaying]); 

  // --- STANDARD CONTROLS ---
  const playTrack = (track: Track, playlist: Track[] = []) => {
    if (currentTrack?.id === track.id) togglePlayPause();
    else {
      setCurrentTrack(track);
      setIsPlaying(true);
      setPlayerVisible(true);
      if (playlist.length > 0) setQueue(playlist);
      else if (queue.length === 0) setQueue([track]); 
    }
  };

  const togglePlayPause = () => { if (currentTrack) setIsPlaying(!isPlaying); };

  const playNext = () => {
    if (!currentTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) playTrack(queue[currentIndex + 1]);
    else setIsPlaying(false);
  };

  const playPrevious = () => {
    if (!currentTrack || queue.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 2) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) playTrack(queue[currentIndex - 1]);
  };

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying]); 

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return (
    <PlayerContext.Provider value={{ 
      currentTrack, 
      isPlaying, 
      progress, 
      liveMeta, 
      liveElapsed, 
      liveDuration, 
      playTrack, 
      togglePlayPause, 
      playNext, 
      playPrevious, 
      audioRef, 
      isPlayerVisible, 
      setPlayerVisible, 
      volume, 
      setVolume
    }}>
      {children}
      
      {currentTrack && trackId && (
        <audio 
          key={trackId}
          ref={audioRef}
          crossOrigin="anonymous"
          onEnded={playNext} 
          onTimeUpdate={() => {
            if (audioRef.current && !isLiveStream) {
              const p = (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
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