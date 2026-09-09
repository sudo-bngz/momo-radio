import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { DashboardData, NowPlayingInfo } from '../../../types';

export const useDashboard = (orgId?: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  
  // Real-time track state
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null);
  // Fast 1-second clock for the waveform progress
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

  // 1. Fetch dashboard metrics (storage, tracks, uptime) - Polled every 60s
  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        const result = await api.getDashboardStats();
        if (mounted) setData(result);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); 

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;

    // Get the properly formatted URL from your centralized API service
    const sseUrl = api.getNowPlayingStreamUrl(orgId);
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const parsed: NowPlayingInfo = JSON.parse(event.data);
        setNowPlaying(parsed);
      } catch (err) {
        console.error("Failed to parse SSE payload", err);
      }
    };

    return () => eventSource.close();
  }, [orgId]);

  // 3. Local clock to drive the waveform elapsed time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatStorage = (bytes: number): string => {
    if (!bytes) return "0 GB";
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Calculate live progression for the player
  const calculateLiveState = () => {
    if (!nowPlaying?.starts_at) {
      return { elapsed_ms: 0, timeRemaining: "--:--" };
    }

    const start = new Date(nowPlaying.starts_at).getTime();
    const end = nowPlaying.ends_at ? new Date(nowPlaying.ends_at).getTime() : start;
    
    const elapsedMs = Math.max(0, currentTimeMs - start);
    const remainingMs = Math.max(0, end - currentTimeMs);

    const totalSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    
    return {
      elapsed_ms: elapsedMs,
      timeRemaining: `${mins}:${secs.toString().padStart(2, '0')}`
    };
  };

  const liveState = calculateLiveState();

  return {
    isLoading,
    stats: {
      totalTracks: data?.stats.total_tracks ?? 0,
      totalPlaylists: data?.stats.total_playlists ?? 0,
      uptime: data?.stats.uptime ?? "100%",
      storageUsed: formatStorage(data?.stats.storage_used_bytes ?? 0),
    },
    recentTracks: data?.recent_tracks ?? [],
    
    nowPlaying: (nowPlaying
      ? {
          ...nowPlaying,
          elapsed_ms: liveState.elapsed_ms,
          timeRemaining: liveState.timeRemaining,
        }
      : {
          title: "Silence",
          artist: "Station Offline",
          playlist_name: "No Schedule",
          elapsed_ms: 0,
          duration_ms: 0,
          starts_at: undefined,
          ends_at: undefined,
          track_id: undefined,
          waveform_key: undefined,
          cover_url: undefined,
          timeRemaining: "--:--",
        }) as NowPlayingInfo & { timeRemaining: string },
  };
};